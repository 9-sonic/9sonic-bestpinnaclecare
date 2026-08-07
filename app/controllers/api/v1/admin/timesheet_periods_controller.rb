module Api
  module V1
    module Admin
      class TimesheetPeriodsController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :finance) }, only: %i[create approve lock]

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
