module Api
  module V1
    module Staff
      # GET /api/v1/staff/timesheet?period=<id> — the carer's own attendance lines.
      class TimesheetController < BaseController
        def show
          lines = current_employee.timesheet_lines.order(work_date: :desc)
          lines = lines.where(timesheet_period_id: params[:period]) if params[:period].present?
          render json: lines.map { |l| TimesheetLineSerializer.call(l) }
        end
      end
    end
  end
end
