module Api
  module V1
    module Admin
      class EmployeesController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) }, only: %i[create update]

        def index
          render json: Employee.order(:last_name, :first_name).map { |e| serialize(e) }
        end

        def show
          render json: serialize(Employee.find(params[:id]))
        end

        # GET /api/v1/admin/employees/:id/availability
        def availability
          render json: Employee.find(params[:id]).employee_availabilities.order(:weekday, :slot)
                               .map { |a| EmployeeAvailabilitySerializer.call(a) }
        end

        # POST /api/v1/admin/employees — invite a carer
        def create
          employee = Authentication::InviteEmployee.call(attrs: employee_params, invited_by: current_admin)
          render json: serialize(employee), status: :created
        end

        def update
          employee = Employee.find(params[:id])
          employee.update!(employee_params)
          render json: serialize(employee)
        end

        private

        # Pay only for finance / registered manager.
        def serialize(e)
          EmployeeSerializer.call(e, include_private: true, include_pay: current_admin.registered_manager? || current_admin.finance?)
        end

        def employee_params
          params.permit(:email, :first_name, :last_name, :phone, :role, :employee_reference, :active,
                        :hourly_rate_pence, :mileage_rate_pence, :contracted_hours_per_week)
        end
      end
    end
  end
end
