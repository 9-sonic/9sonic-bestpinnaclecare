module Api
  module V1
    module Admin
      class TimesheetPeriodsController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :finance) }, only: %i[create approve approve_carer lock]

        def index
          render json: TimesheetPeriod.order(starts_on: :desc).map { |p| TimesheetPeriodSerializer.call(p) }
        end

        def show
          render json: TimesheetPeriodSerializer.call(TimesheetPeriod.find(params[:id]), include_lines: true)
        end

        # POST /api/v1/admin/timesheet_periods { starts_on } — build/refresh from attendance
        def create
          period = Timesheets::BuildPeriod.call(starts_on: params.require(:starts_on))
          render json: TimesheetPeriodSerializer.call(period, include_lines: true), status: :created
        end

        def approve
          result = Timesheets::ApprovePeriod.call(TimesheetPeriod.find(params[:id]), current_admin)
          if result.ok
            Events::Record.call(
              aggregate: result.period, actor: current_admin, event_type: "timesheet.approved",
              payload: { starts_on: result.period.starts_on, ends_on: result.period.ends_on }
            )
            render json: TimesheetPeriodSerializer.call(result.period)
          else
            render json: { error: result.error }, status: 422
          end
        end

        # POST /api/v1/admin/timesheet_periods/:id/approve_carer { employee_id }
        # Approve one carer's lines within the period, without approving the whole
        # agency. Additive to #approve — the period stays open.
        def approve_carer
          period   = TimesheetPeriod.find(params[:id])
          employee = Employee.find(params.require(:employee_id))
          result   = Timesheets::ApproveCarerLines.call(period, employee, current_admin)

          if result.ok
            Events::Record.call(
              aggregate: period, actor: current_admin, event_type: "timesheet.carer_approved",
              payload: { employee_id: employee.id, employee_name: employee.full_name, approved_count: result.approved_count }
            )
            render json: { employee_id: employee.id, approved_count: result.approved_count }
          else
            render json: { error: result.error }, status: 422
          end
        end

        def lock
          period = Timesheets::LockPeriod.call(TimesheetPeriod.find(params[:id]), current_admin)
          Events::Record.call(
            aggregate: period, actor: current_admin, event_type: "timesheet.locked",
            payload: { starts_on: period.starts_on, ends_on: period.ends_on }
          )
          render json: TimesheetPeriodSerializer.call(period)
        end
      end
    end
  end
end
