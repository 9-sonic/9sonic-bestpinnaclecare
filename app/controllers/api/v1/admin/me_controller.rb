module Api
  module V1
    module Admin
      # GET /api/v1/admin/me
      class MeController < BaseController
        def show
          render json: AdminSerializer.call(current_admin)
        end
      end
    end
  end
end
