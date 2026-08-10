module Api
  module V1
    module Admin
      # GET /api/v1/admin/report_exports?from=<iso>&to=<iso>&type=csv|xlsx
      #
      # Builds a downloadable report pack (CSV or XLSX) from the same
      # aggregates that power the Reports dashboard.
      class ReportExportsController < BaseController
        def show
          to   = parse_time(params[:to]) || Time.current.end_of_day
          from = parse_time(params[:from]) || 7.days.ago.beginning_of_day

          if params[:type] == "xlsx"
            send_data Reports::Exporters::XlsxExporter.call(from: from, to: to),
                      filename: "report-pack-#{from.to_date}.xlsx",
                      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          else
            send_data Reports::Exporters::CsvExporter.call(from: from, to: to),
                      filename: "report-pack-#{from.to_date}.csv", type: "text/csv"
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
