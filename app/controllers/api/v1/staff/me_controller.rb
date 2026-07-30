module Api
  module V1
    module Staff
      # GET/PATCH /api/v1/staff/me — the carer's own profile (sees their private
      # fields + pay). Email and employee_reference stay office-controlled.
      class MeController < BaseController
        def show
          render json: EmployeeSerializer.call(current_employee, include_private: true, include_pay: true)
        end

        def update
          current_employee.update!(profile_params)
          render json: EmployeeSerializer.call(current_employee, include_private: true, include_pay: true)
        end

        private

        def profile_params
          params.permit(:first_name, :last_name, :phone, :emergency_contact_name, :emergency_contact_phone)
        end
      end
    end
  end
end
