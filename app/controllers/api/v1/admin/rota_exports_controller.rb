module Api
  module V1
    module Admin
      # GET /api/v1/admin/rota_exports?from=<iso>&to=<iso>&type=csv|xlsx
      #
      # Downloads the rota (visits + carer assignments) for a date range
      # as a CSV or XLSX file.
      class RotaExportsController < BaseController
        def show
          from = params[:from].present? ? Date.parse(params[:from]) : Date.current.beginning_of_week
          to   = params[:to].present?   ? Date.parse(params[:to])   : from + 6

          if params[:type] == "xlsx"
            send_data Rota::Exporters::XlsxExporter.call(from: from, to: to),
                      filename: "rota-#{from}.xlsx",
                      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          else
            send_data Rota::Exporters::CsvExporter.call(from: from, to: to),
                      filename: "rota-#{from}.csv", type: "text/csv"
          end
        end
      end
    end
  end
end
