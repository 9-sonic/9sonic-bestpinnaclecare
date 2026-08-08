module Api
  module V1
    module Admin
      class VisitsController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) }, only: :update

        # GET /api/v1/admin/visits?from=&to=  (the rota)
        def index
          from = params[:from].present? ? Date.parse(params[:from]) : Date.current
          to   = params[:to].present?   ? Date.parse(params[:to])   : from + 6
          visits = Visit.includes(:service_user, visit_assignments: :employee)
                        .where(scheduled_start: from.beginning_of_day..to.end_of_day)
                        .order(:scheduled_start)
          render json: visits.map { |v| VisitSerializer.call(v, include_service_user: true) }
        end

        # POST /api/v1/admin/visits  (ad-hoc)
        def create
          visit = Visit.create!(visit_params.merge(status: :draft))
          render json: VisitSerializer.call(visit, include_service_user: true), status: :created
        end

        # PATCH /api/v1/admin/visits/:id  { scheduled_start?, scheduled_end?, notes?, reason }
        # Reschedule/retime a visit before it happens. Refuses once a carer has
        # clocked in — an honest record is never rewritten (§ audit-over-edit) —
        # and appends a visit.rescheduled event with who, the before/after and why.
        def update
          visit = Visit.find(params[:id])
          return render json: { error: "visit_cancelled" }, status: 422 if visit.cancelled?
          if visit.visit_assignments.any? { |va| va.actual_start.present? }
            return render json: { error: "visit_started" }, status: 422
          end

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
          visit.update!(status: :published, published_at: Time.current, published_by: current_admin)
          render json: VisitSerializer.call(visit)
        end

        # POST /api/v1/admin/visits/generate  { from, to }  — from care packages
        def generate
          from = Date.parse(params.require(:from))
          to   = Date.parse(params.require(:to))
          created = Visits::GenerateFromCarePackages.call(from: from, to: to)
          render json: { created: created }, status: :created
        end

        private

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
