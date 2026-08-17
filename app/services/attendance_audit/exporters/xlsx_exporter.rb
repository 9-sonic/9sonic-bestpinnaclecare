module AttendanceAudit
  module Exporters
    # CQC visit-attendance audit as XLSX — same columns and cells as the CSV,
    # on a single "Visit Attendance" sheet with a bold header row.
    class XlsxExporter
      def self.call(from:, to:, service_user_id: nil, employee_id: nil)
        rows = AttendanceAudit::Build.call(from: from, to: to, service_user_id: service_user_id, employee_id: employee_id)

        package = Axlsx::Package.new
        wb = package.workbook
        header = wb.styles.add_style(b: true)

        wb.add_worksheet(name: "Visit Attendance") do |sheet|
          sheet.add_row AttendanceAudit::Rows::HEADERS, style: header
          rows.each { |r| sheet.add_row AttendanceAudit::Rows.cells(r) }
        end

        package.to_stream.read
      end
    end
  end
end
