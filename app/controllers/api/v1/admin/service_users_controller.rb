module Api
  module V1
    module Admin
      class ServiceUsersController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) }, only: %i[create update]
        def index
          stats = ::ServiceUsers::Stats.call
          paginate(ServiceUser.order(:last_name, :first_name)) { |su| ServiceUserSerializer.call(su).merge(stats[su.id] || {}) }
        end

        def show
          su = ServiceUser.find(params[:id])
          # Merge the same per-client stats the list shows (visits/week, adherence,
          # regular carers) so the detail page can display them too.
          stats = ::ServiceUsers::Stats.call(only: su.id)[su.id] || {}
          render json: ServiceUserSerializer.call(su).merge(stats)
        end

        # GET /api/v1/admin/service_users/:id/notes  — the client's visit-note
        # journal across every visit, newest first. This is how the office sees
        # a trend over time ("she's eaten less all week") rather than one visit.
        #
        # Filters (all optional): q (body search), from/to (date range on the
        # visit), employee_id (a specific carer). Paginated so a year of notes
        # never lands in one response.
        def notes
          su = ServiceUser.find(params[:id])
          scope = VisitNote.effective
                           .joins(visit_assignment: :visit)
                           .where(visits: { service_user_id: su.id })

          if params[:q].present?
            scope = scope.where("visit_notes.body ILIKE ?", "%#{ActiveRecord::Base.sanitize_sql_like(params[:q])}%")
          end
          if params[:employee_id].present?
            scope = scope.where(visit_assignments: { employee_id: params[:employee_id] })
          end
          # parse returns nil on malformed input — guard so a bad ?from=/&to=
          # filters nothing rather than raising NoMethodError.
          if (from = safe_time(params[:from]))
            scope = scope.where("visits.scheduled_start >= ?", from.beginning_of_day)
          end
          if (to = safe_time(params[:to]))
            scope = scope.where("visits.scheduled_start <= ?", to.end_of_day)
          end

          page     = [ params.fetch(:page, 1).to_i, 1 ].max
          per_page = params.fetch(:per_page, 50).to_i.clamp(1, 100)
          total    = scope.count
          notes    = scope.preload(:author, visit_assignment: %i[visit employee])
                          .order(created_at: :desc)
                          .offset((page - 1) * per_page).limit(per_page)

          render json: {
            notes: notes.map { |n|
              va = n.visit_assignment
              VisitNoteSerializer.call(n).merge(
                visit_id: va.visit_id,
                visit_scheduled_start: va.visit.scheduled_start&.iso8601,
                employee_id: va.employee_id,
                employee_name: va.employee&.full_name
              )
            },
            page: page, per_page: per_page, total: total
          }
        end

        # GET /api/v1/admin/service_users/:id/visits  — this client's visits,
        # newest first, so the office can answer "which carers attended this
        # patient, and when" and open any visit as a full record.
        #
        # Filters (all optional): from/to (date range), employee_id (only visits
        # a specific carer attended). Paginated so a year of visits is reachable.
        def visits
          su = ServiceUser.find(params[:id])
          scope = Visit.where(service_user_id: su.id)
                       .includes(visit_assignments: :employee)
                       .order(scheduled_start: :desc)

          if params[:employee_id].present?
            scope = scope.where(visit_assignments: { employee_id: params[:employee_id] })
                         .joins(:visit_assignments).distinct
          end
          if (from = safe_time(params[:from]))
            scope = scope.where("visits.scheduled_start >= ?", from.beginning_of_day)
          end
          if (to = safe_time(params[:to]))
            scope = scope.where("visits.scheduled_start <= ?", to.end_of_day)
          end

          page     = [ params.fetch(:page, 1).to_i, 1 ].max
          per_page = params.fetch(:per_page, 50).to_i.clamp(1, 100)
          total    = scope.count
          visits   = scope.offset((page - 1) * per_page).limit(per_page)

          render json: {
            items: visits.map { |v| visit_row(v) },
            page: page, per_page: per_page, total: total
          }
        end

        def create
          su = ServiceUser.create!(service_user_params)
          Events::Record.call(
            aggregate: su, actor: current_admin, event_type: "service_user.created",
            payload: { changes: su.attributes.slice(*service_user_params.keys.map(&:to_s)) }
          )
          render json: ServiceUserSerializer.call(su), status: :created
        end

        def update
          su = ServiceUser.find(params[:id])
          before = su.attributes.slice(*service_user_params.keys.map(&:to_s))
          su.update!(service_user_params)
          after = su.attributes.slice(*service_user_params.keys.map(&:to_s))
          changed = after.keys.select { |k| before[k] != after[k] }
          if changed.any?
            Events::Record.call(
              aggregate: su, actor: current_admin, event_type: "service_user.updated",
              payload: { from: before.slice(*changed), to: after.slice(*changed) }
            )
          end
          render json: ServiceUserSerializer.call(su)
        end

        private

        # Compact per-visit row for the client's Visits list: when, its state, and
        # who attended (the assigned carers), so "which carer attended" is answered
        # in the list without opening each visit.
        def visit_row(v)
          assigned = v.visit_assignments.select { |va| va.assignment_status == "assigned" }
          {
            id:              v.id,
            scheduled_start: v.scheduled_start&.iso8601,
            scheduled_end:   v.scheduled_end&.iso8601,
            status:          v.status,
            carers: assigned.map { |va|
              {
                assignment_id:   va.id,
                employee_id:     va.employee_id,
                employee_name:   va.employee&.full_name,
                lifecycle_state: va.lifecycle_state,
                actual_start:    va.actual_start&.iso8601,
                actual_end:      va.actual_end&.iso8601,
                worked_minutes:  va.worked_minutes
              }
            }
          }
        end

        # Time.zone.parse but nil-safe on blank/garbage input.
        def safe_time(str)
          return nil if str.blank?

          Time.zone.parse(str)
        rescue ArgumentError
          nil
        end

        def service_user_params
          params.permit(:first_name, :last_name, :reference, :date_of_birth, :phone,
                        :address_line1, :address_line2, :city, :postcode,
                        :lat, :lng, :geofence_radius_m, :geofence_mode, :access_notes, :active)
        end
      end
    end
  end
end
