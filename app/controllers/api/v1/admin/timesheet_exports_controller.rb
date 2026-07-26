module Api
  module V1
    module Admin
      # GET /api/v1/admin/timesheet_exports/:id?type=csv|xlsx
      class TimesheetExportsController < BaseController
        def show
          period = TimesheetPeriod.find(params[:id])

          if params[:type] == "xlsx"
            send_data Timesheets::Exporters::XlsxExporter.call(period),
                      filename: "timesheet-#{period.starts_on}.xlsx",
                      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          else
            send_data Timesheets::Exporters::CsvExporter.call(period),
                      filename: "timesheet-#{period.starts_on}.csv", type: "text/csv"
          end
        end
      end
    end
  end
end
