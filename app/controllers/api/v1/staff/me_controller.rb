module Api
  module V1
    module Staff
      # GET/PATCH /api/v1/staff/me — the carer's own profile (sees their private
      # fields). Email and employee_reference stay office-controlled.
      class MeController < BaseController
        include AvatarManagement

        def show
          render json: serialized
        end

        def update
          current_employee.update!(profile_params)
          render json: serialized
        end

        # POST /api/v1/staff/me/avatar  (multipart: avatar)
        def avatar
          render json: serialized if attach_avatar_or_422(current_employee)
        end

        # DELETE /api/v1/staff/me/avatar
        def remove_avatar
          current_employee.avatar.purge_later
          render json: serialized
        end

        private

        def serialized = EmployeeSerializer.call(current_employee, include_private: true)

        def profile_params
          params.permit(:first_name, :last_name, :phone, :emergency_contact_name, :emergency_contact_phone)
        end
      end
    end
  end
end
