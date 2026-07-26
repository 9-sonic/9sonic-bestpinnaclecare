module Api
  module V1
    module Staff
      # POST /api/v1/staff/auth/login — authenticates against the employees table only.
      class AuthController < ApplicationController
        include TokenAuthentication

        def create
          login_with(Employee, :employee, EmployeeSerializer)
        end
      end
    end
  end
end
