module Api
  module V1
    module Staff
      # GET /api/v1/staff/me
      class MeController < BaseController
        def show
          render json: EmployeeSerializer.call(current_employee)
        end
      end
    end
  end
end
