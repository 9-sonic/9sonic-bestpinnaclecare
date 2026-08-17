require "csv"

module AttendanceAudit
  module Exporters
    # CQC visit-attendance audit as CSV — one row per carer x visit, with the
    # exact column layout of the client's existing export.
    class CsvExporter
      def self.call(from:, to:, service_user_id: nil, employee_id: nil)
        rows = AttendanceAudit::Build.call(from: from, to: to, service_user_id: service_user_id, employee_id: employee_id)

        CSV.generate do |csv|
          csv << AttendanceAudit::Rows::HEADERS
          rows.each { |r| csv << AttendanceAudit::Rows.cells(r) }
        end
      end
    end
  end
end
