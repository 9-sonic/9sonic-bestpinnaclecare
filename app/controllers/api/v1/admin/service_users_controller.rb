module Api
  module V1
    module Admin
      class ServiceUsersController < BaseController
        def index
          stats = ::ServiceUsers::Stats.call
          render json: ServiceUser.order(:last_name, :first_name).map { |su| ServiceUserSerializer.call(su).merge(stats[su.id] || {}) }
        end

        def show
          render json: ServiceUserSerializer.call(ServiceUser.find(params[:id]))
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
          if params[:from].present?
            scope = scope.where("visits.scheduled_start >= ?", Time.zone.parse(params[:from]).beginning_of_day)
          end
          if params[:to].present?
            scope = scope.where("visits.scheduled_start <= ?", Time.zone.parse(params[:to]).end_of_day)
          end

          page     = [params.fetch(:page, 1).to_i, 1].max
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

        def create
          su = ServiceUser.create!(service_user_params)
          render json: ServiceUserSerializer.call(su), status: :created
        end

        def update
          su = ServiceUser.find(params[:id])
          su.update!(service_user_params)
          render json: ServiceUserSerializer.call(su)
        end

        private

        def service_user_params
          params.permit(:first_name, :last_name, :reference, :date_of_birth, :phone,
                        :address_line1, :address_line2, :city, :postcode,
                        :lat, :lng, :geofence_radius_m, :geofence_mode, :access_notes, :active)
        end
      end
    end
  end
end
