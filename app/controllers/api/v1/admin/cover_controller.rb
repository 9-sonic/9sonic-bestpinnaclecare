module Api
  module V1
    module Admin
      # GET /api/v1/admin/cover — unfilled visits, their offers and cover state.
      class CoverController < BaseController
        def index
          render json: Cover::Board.call
        end
      end
    end
  end
end
