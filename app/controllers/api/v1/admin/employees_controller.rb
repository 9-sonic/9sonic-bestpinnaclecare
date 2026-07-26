module Api
  module V1
    module Admin
      class EmployeesController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) }, except: :index

        def index
          render json: Employee.order(:last_name, :first_name).map { |e| EmployeeSerializer.call(e) }
        end

        def show
          render json: EmployeeSerializer.call(Employee.find(params[:id]))
        end

        # POST /api/v1/admin/employees — invite a carer
        def create
          employee = Authentication::InviteEmployee.call(attrs: employee_params, invited_by: current_admin)
          render json: EmployeeSerializer.call(employee), status: :created
        end

        def update
          employee = Employee.find(params[:id])
          employee.update!(employee_params)
          render json: EmployeeSerializer.call(employee)
        end

        private

        def employee_params
          params.permit(:email, :first_name, :last_name, :phone, :role, :employee_reference, :active)
        end
      end
    end
  end
end
