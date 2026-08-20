module Api
  module V1
    module Admin
      class VisitsController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) }, only: %i[update cancel destroy]

        # GET /api/v1/admin/visits?from=&to=  (the rota)
        def index
          from = params[:from].present? ? Date.parse(params[:from]) : Date.current
          to   = params[:to].present?   ? Date.parse(params[:to])   : from + 6
          visits = Visit.includes(:service_user, visit_assignments: :employee)
                        .where(scheduled_start: from.beginning_of_day..to.end_of_day)
                        .order(:scheduled_start)
          paginate(visits, per_page: 100) { |v| VisitSerializer.call(v, include_service_user: true) }
        end

        # GET /api/v1/admin/visits/:id  — the office view of one visit's care
        # delivery: the schedule, the care plan, which tasks were done, and the
        # carer's notes. Read-only; mirrors what the carer saw and recorded.
        def show
          visit = Visit.includes(:service_user, visit_assignments: [ :employee, :visit_tasks, :visit_notes, { clock_events: :device } ]).find(params[:id])
          su = visit.service_user
          render json: VisitSerializer.call(visit, include_service_user: true).merge(
            care_plan: su.care_plan_items.active.map { |c| CarePlanItemSerializer.call(c) },
            assignments: visit.visit_assignments.map do |va|
              {
                id: va.id,
                # name + full_name: keep the shape uniform with every other
                # employee object in the API so fullName() works either way.
                employee: va.employee && { id: va.employee.id, name: va.employee.full_name, full_name: va.employee.full_name },
                assignment_status: va.assignment_status,
                lifecycle_state:   va.lifecycle_state,
                actual_start:      va.actual_start&.iso8601,
                actual_end:        va.actual_end&.iso8601,
                worked_minutes:    va.worked_minutes,
                tasks: va.visit_tasks.map { |t| VisitTaskSerializer.call(t) },
                notes: va.visit_notes.effective.sort_by(&:created_at).map { |n| VisitNoteSerializer.call(n) },
                # The clock history for this carer on this visit — in/out taps with
                # location, so a visit reads as a complete record of what happened.
                clock_events: va.clock_events.sort_by(&:occurred_at).map { |ce| ClockEventSerializer.call(ce) }
              }
            end
          )
        end

        # POST /api/v1/admin/visits  (ad-hoc)
        def create
          attrs = visit_params
          start = attrs[:scheduled_start].present? ? Time.zone.parse(attrs[:scheduled_start].to_s) : nil
          finish = attrs[:scheduled_end].present? ? Time.zone.parse(attrs[:scheduled_end].to_s) : nil
          if start&.past?
            return render json: { error: "visit_in_past" }, status: :unprocessable_entity
          end

          # One service user, one carer at a time — a client can't have two visits
          # that overlap in time. Refuse before creating the clashing visit rather
          # than only blocking the second carer's assignment later.
          if start && finish && client_visit_overlap(attrs[:service_user_id], start, finish)
            return render json: { error: "client_overlap" }, status: :unprocessable_entity
          end

          visit = Visit.create!(attrs.merge(status: :draft))
          render json: VisitSerializer.call(visit, include_service_user: true), status: :created
        end

        # PATCH /api/v1/admin/visits/:id  { scheduled_start?, scheduled_end?, notes?, reason }
        # Reschedule/retime a visit, including past or already-started ones (admin
        # reconciliation). Every edit appends a visit.rescheduled event with who,
        # the before/after and why — the schedule change is audited, not silent.
        def update
          visit = Visit.find(params[:id])
          return render json: { error: "visit_cancelled" }, status: 422 if visit.cancelled?

          reason = params[:reason].to_s.strip
          return render json: { error: "reason_required" }, status: 422 if reason.blank?

          before = { scheduled_start: visit.scheduled_start&.iso8601, scheduled_end: visit.scheduled_end&.iso8601 }
          visit.update!(update_params)
          Events::Record.call(
            aggregate: visit, actor: current_admin, event_type: "visit.rescheduled",
            payload: { reason: reason, from: before,
                       to: { scheduled_start: visit.scheduled_start&.iso8601, scheduled_end: visit.scheduled_end&.iso8601 } }
          )
          render json: VisitSerializer.call(visit, include_service_user: true)
        end

        # POST /api/v1/admin/visits/:id/publish
        def publish
          visit = Visit.find(params[:id])
          # A visit can't be published once its start time has passed — publishing
          # is a forward-looking act, and back-dating it would let invalid data
          # into the rota (breaking scheduling, payroll and care delivery).
          if visit.scheduled_start.present? && visit.scheduled_start.past?
            return render json: { error: "visit_in_past" }, status: 422
          end

          visit.update!(status: :published, published_at: Time.current, published_by: current_admin)
          render json: VisitSerializer.call(visit)
        end

        # POST /api/v1/admin/visits/:id/cancel  { reason }
        # Soft-cancels the visit and frees the assigned carer(s) by withdrawing
        # their assignments (they're then available for that time again). Never a
        # hard delete — a visit that carries clock history keeps its audit trail.
        # Refused once a carer has clocked in: the honest record isn't erased.
        def cancel
          visit  = Visit.find(params[:id])
          reason = params[:reason].to_s.strip

          return render json: { error: "already_cancelled" }, status: 422 if visit.cancelled?
          return render json: { error: "reason_required" }, status: 422 if reason.blank?
          if visit.visit_assignments.any? { |va| va.actual_start.present? }
            return render json: { error: "visit_started" }, status: 422
          end

          ActiveRecord::Base.transaction do
            visit.visit_assignments.assigned.each do |va|
              va.update!(assignment_status: "withdrawn", lifecycle_state: :cancelled)
            end
            visit.update!(status: :cancelled, cancelled_at: Time.current, cancellation_reason: reason)
            Events::Record.call(
              aggregate: visit, actor: current_admin, event_type: "visit.cancelled",
              payload: { reason: reason }
            )
          end
          render json: VisitSerializer.call(visit, include_service_user: true)
        end

        # DELETE /api/v1/admin/visits/:id
        # Hard-delete a visit that will never happen and carries NO clock history —
        # a mistaken or genuinely dropped call. The moment a carer has clocked in,
        # deletion is refused: that visit holds an official record which is never
        # erased (use cancel instead, which preserves the audit trail). Assignments
        # cascade away with the visit, freeing the carer(s); clock_events /
        # visit_notes are guarded by dependent: :restrict_with_error as a backstop.
        def destroy
          visit = Visit.find(params[:id])

          if visit.visit_assignments.any? { |va| va.actual_start.present? }
            return render json: { error: "visit_started" }, status: 422
          end

          ActiveRecord::Base.transaction do
            Events::Record.call(
              aggregate: visit, actor: current_admin, event_type: "visit.deleted",
              payload: { service_user_id: visit.service_user_id, scheduled_start: visit.scheduled_start&.iso8601 }
            )
            visit.destroy!
          end
          head :no_content
        rescue ActiveRecord::RecordNotDestroyed, ActiveRecord::InvalidForeignKey
          # A note or clock record blocked the cascade — never erase held history.
          render json: { error: "visit_has_records" }, status: 422
        end

        # POST /api/v1/admin/visits/generate  { from, to }  — from care packages
        def generate
          from = Date.parse(params.require(:from))
          to   = Date.parse(params.require(:to))
          created = Visits::GenerateFromCarePackages.call(from: from, to: to)
          render json: { created: created }, status: :created
        end

        private

        # True if this client already has a non-cancelled visit overlapping the
        # given window. Half-open overlap: starts < b_end && a_start < ends.
        def client_visit_overlap(service_user_id, start, finish)
          Visit.where(service_user_id: service_user_id)
               .where.not(status: :cancelled)
               .where("scheduled_start < ? AND scheduled_end > ?", finish, start)
               .exists?
        end

        def visit_params
          params.permit(:service_user_id, :care_package_slot_id, :scheduled_start, :scheduled_end,
                        :staff_required, :break_minutes, :notes)
        end

        # Only the schedulable fields — never service_user or care package linkage.
        def update_params
          params.permit(:scheduled_start, :scheduled_end, :staff_required, :break_minutes, :notes)
        end
      end
    end
  end
end
