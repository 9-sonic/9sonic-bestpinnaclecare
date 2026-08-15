module Api
  module V1
    module Admin
      # GET /api/v1/admin/attendance_audit_exports?from=<iso>&to=<iso>&type=csv|xlsx
      #
      # Streams the CQC visit-attendance audit (one row per carer x visit over
      # the date range) as a downloadable CSV or XLSX. Defaults to the last 7
      # days if no range is given.
      class AttendanceAuditExportsController < BaseController
        def show
          to   = parse_time(params[:to]) || Time.current.end_of_day
          from = parse_time(params[:from]) || 7.days.ago.beginning_of_day

          if params[:type] == "xlsx"
            send_data AttendanceAudit::Exporters::XlsxExporter.call(from: from, to: to),
                      filename: "visit-audit-#{from.to_date}.xlsx",
                      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          else
            send_data AttendanceAudit::Exporters::CsvExporter.call(from: from, to: to),
                      filename: "visit-audit-#{from.to_date}.csv", type: "text/csv"
          end
        end

        private

        def parse_time(str)
          Time.zone.parse(str) if str.present?
        rescue ArgumentError, TypeError
          nil
        end
      end
    end
  end
end
