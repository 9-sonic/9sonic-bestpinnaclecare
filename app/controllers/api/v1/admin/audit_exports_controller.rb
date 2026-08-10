module Api
  module V1
    module Admin
      # GET /api/v1/admin/audit_exports?type=csv|xlsx
      #   &event_type=...&aggregate_type=...&limit=...
      #
      # Streams the audit log as a downloadable file. Accepts the same
      # filter params as AuditController#index.
      class AuditExportsController < BaseController
        def show
          scope = Event.includes(:actor).order(occurred_at: :desc)
          scope = scope.where(event_type: params[:event_type]) if params[:event_type].present?
          scope = scope.where(aggregate_type: params[:aggregate_type]) if params[:aggregate_type].present?
          scope = scope.limit((params[:limit] || 1000).to_i.clamp(1, 10_000))

          if params[:type] == "xlsx"
            send_data Audit::Exporters::XlsxExporter.call(scope),
                      filename: "audit-log-#{Date.current}.xlsx",
                      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          else
            send_data Audit::Exporters::CsvExporter.call(scope),
                      filename: "audit-log-#{Date.current}.csv", type: "text/csv"
          end
        end
      end
    end
  end
end
