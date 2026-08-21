module Api
  module V1
    module Admin
      # GET /api/v1/admin/attendance_audit_exports?from=<iso>&to=<iso>&type=csv|xlsx
      #
      # Streams the CQC visit-attendance audit (one row per carer x visit over
      # the date range) as a downloadable CSV or XLSX. Defaults to the last 7
      # days if no range is given.
      class AttendanceAuditExportsController < BaseController
        # GET /api/v1/admin/attendance_audit_exports/rows?from=&to=&service_user_id=&employee_id=
        #
        # The same CQC visit-attendance rows as JSON, for the on-screen filterable
        # table on Timesheets — optionally narrowed to one client and/or carer.
        def rows
          to   = parse_time(params[:to]) || Time.current.end_of_day
          from = parse_time(params[:from]) || 7.days.ago.beginning_of_day
          page     = [ params.fetch(:page, 1).to_i, 1 ].max
          per_page = params.fetch(:per_page, 50).to_i.clamp(1, 200)

          result = AttendanceAudit::Build.page(from: from, to: to, page: page, per_page: per_page, **filter_params)
          render json: {
            items:    result[:rows].map { |r| AttendanceAuditRowSerializer.call(r) },
            total:    result[:total],
            summary:  result[:summary],
            page:     page,
            per_page: per_page
          }
        end

        def show
          to   = parse_time(params[:to]) || Time.current.end_of_day
          from = parse_time(params[:from]) || 7.days.ago.beginning_of_day

          if params[:type] == "xlsx"
            send_data AttendanceAudit::Exporters::XlsxExporter.call(from: from, to: to, **filter_params),
                      filename: "visit-audit-#{from.to_date}.xlsx",
                      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          else
            send_data AttendanceAudit::Exporters::CsvExporter.call(from: from, to: to, **filter_params),
                      filename: "visit-audit-#{from.to_date}.csv", type: "text/csv"
          end
        end

        private

        def filter_params
          { service_user_id: params[:service_user_id].presence, employee_id: params[:employee_id].presence }
        end

        def parse_time(str)
          Time.zone.parse(str) if str.present?
        rescue ArgumentError, TypeError
          nil
        end
      end
    end
  end
end
