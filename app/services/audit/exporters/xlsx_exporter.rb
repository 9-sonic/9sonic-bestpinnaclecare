module Audit
  module Exporters
    # Exports the Event audit log to XLSX. Accepts the same scope/filter
    # params used by AuditController#index.
    class XlsxExporter
      def self.call(scope)
        package = Axlsx::Package.new
        package.workbook.add_worksheet(name: "Audit Log") do |sheet|
          sheet.add_row CsvExporter::HEADERS
          scope.find_each do |e|
            sheet.add_row [
              e.occurred_at&.iso8601,
              e.event_type,
              e.actor_type,
              CsvExporter.actor_name(e),
              e.aggregate_type,
              e.aggregate_id.to_s,
              e.payload&.to_json
            ]
          end
        end
        package.to_stream.read
      end
    end
  end
end
