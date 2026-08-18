module Api
  module V1
    module Admin
      class EmployeesController < BaseController
        include AvatarManagement

        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) },          only: %i[create avatar remove_avatar]
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator, :finance) }, only: :update

        def index
          stats = ::Staff::Stats.call
          paginate(Employee.order(:last_name, :first_name)) { |e| serialize(e).merge(stats[e.id] || {}) }
        end

        def show
          render json: serialize(Employee.find(params[:id]))
        end

        # GET /api/v1/admin/employees/:id/availability
        def availability
          render json: Employee.find(params[:id]).employee_availabilities.order(:weekday, :slot)
                               .map { |a| EmployeeAvailabilitySerializer.call(a) }
        end

        # POST /api/v1/admin/employees/:id/avatar  (multipart: avatar)
        def avatar
          employee = Employee.find(params[:id])
          render json: serialize(employee) if attach_avatar_or_422(employee)
        end

        # DELETE /api/v1/admin/employees/:id/avatar
        def remove_avatar
          employee = Employee.find(params[:id])
          employee.avatar.purge_later
          render json: serialize(employee)
        end

        # POST /api/v1/admin/employees — invite a carer
        def create
          employee = Authentication::InviteEmployee.call(attrs: employee_params, invited_by: current_admin)
          Events::Record.call(
            aggregate: employee, actor: current_admin, event_type: "employee.invited",
            payload: { email: employee.email }
          )
          render json: serialize(employee), status: :created
        end

        def update
          employee = Employee.find(params[:id])
          keys = employee_params.keys
          before = employee.attributes.slice(*keys)
          employee.update!(employee_params)
          after = employee.attributes.slice(*keys)
          changed = after.keys.select { |k| before[k] != after[k] }
          if changed.any?
            # employee_params already strips pay fields for a non-pay-editor, so
            # changed can only include them when the acting admin was authorised
            # to set them — nothing further to redact here.
            Events::Record.call(
              aggregate: employee, actor: current_admin, event_type: "employee.updated",
              payload: { from: before.slice(*changed), to: after.slice(*changed), changed: changed }
            )
          end
          render json: serialize(employee)
        end

        private

        # Pay only for finance / registered manager.
        def serialize(e)
          EmployeeSerializer.call(e, include_private: true, include_pay: current_admin.registered_manager? || current_admin.finance?)
        end

        def employee_params
          permitted = params.permit(:email, :first_name, :last_name, :phone, :employee_reference, :active,
                                    :hourly_rate_pence, :mileage_rate_pence, :contracted_hours_per_week)
          # Only finance / registered manager may set pay rates.
          permitted = permitted.except(:hourly_rate_pence, :mileage_rate_pence) unless pay_editor?
          permitted
        end

        def pay_editor? = current_admin.registered_manager? || current_admin.finance?
      end
    end
  end
end
