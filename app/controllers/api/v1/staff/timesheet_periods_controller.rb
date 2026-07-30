module Api
  module V1
    module Staff
      # GET /api/v1/staff/timesheet_periods — periods this carer has lines in, so
      # the app can show which week it's viewing and whether it's approved.
      class TimesheetPeriodsController < BaseController
        def index
          period_ids = current_employee.timesheet_lines.distinct.pluck(:timesheet_period_id)
          render json: TimesheetPeriod.where(id: period_ids).order(starts_on: :desc)
                                      .map { |p| TimesheetPeriodSerializer.call(p) }
        end
      end
    end
  end
end
