module Api
  module V1
    module Admin
      # POST /api/v1/admin/rota_copies  { from_week_start, to_week_start }
      class RotaCopiesController < BaseController
        def create
          created = Visits::CopyWeek.call(
            from_week_start: Date.parse(params.require(:from_week_start)),
            to_week_start:   Date.parse(params.require(:to_week_start))
          )
          render json: { created: created }, status: :created
        end
      end
    end
  end
end
