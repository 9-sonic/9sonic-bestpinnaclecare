module Api
  module V1
    module Staff
      # POST /api/v1/staff/disputes { timesheet_line_id, reason }
      class DisputesController < BaseController
        def create
          line = current_employee.timesheet_lines.find(params.require(:timesheet_line_id))
          dispute = Timesheets::RaiseDispute.call(line: line, employee: current_employee, reason: params.require(:reason))
          render json: TimesheetDisputeSerializer.call(dispute), status: :created
        end
      end
    end
  end
end
