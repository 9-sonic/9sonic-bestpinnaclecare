module Api
  module V1
    module Admin
      class VisitsController < BaseController
        # GET /api/v1/admin/visits?from=&to=  (the rota)
        def index
          from = params[:from].present? ? Date.parse(params[:from]) : Date.current
          to   = params[:to].present?   ? Date.parse(params[:to])   : from + 6
          visits = Visit.includes(:service_user)
                        .where(scheduled_start: from.beginning_of_day..to.end_of_day)
                        .order(:scheduled_start)
          render json: visits.map { |v| VisitSerializer.call(v, include_service_user: true) }
        end

        # POST /api/v1/admin/visits  (ad-hoc)
        def create
          visit = Visit.create!(visit_params.merge(status: :draft))
          render json: VisitSerializer.call(visit, include_service_user: true), status: :created
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
      end
    end
  end
end
