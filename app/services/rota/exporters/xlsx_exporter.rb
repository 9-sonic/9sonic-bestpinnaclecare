module Rota
  module Exporters
    # Exports the weekly rota (visits + assignments) to XLSX.
    class XlsxExporter
      def self.call(from:, to:)
        visits = Visit.includes(:service_user, visit_assignments: :employee)
                      .where(scheduled_start: from.beginning_of_day..to.end_of_day)
                      .order(:scheduled_start)

        package = Axlsx::Package.new
        package.workbook.add_worksheet(name: "Rota") do |sheet|
          sheet.add_row CsvExporter::HEADERS
          visits.each do |v|
            su = v.service_user
            if v.visit_assignments.any?
              v.visit_assignments.each do |va|
                sheet.add_row CsvExporter.row(v, su, va)
              end
            else
              sheet.add_row CsvExporter.row(v, su, nil)
            end
          end
        end
        package.to_stream.read
      end
    end
  end
end
