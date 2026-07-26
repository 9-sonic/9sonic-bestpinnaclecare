module Timesheets
  module Exporters
    class XlsxExporter
      def self.call(period)
        package = Axlsx::Package.new
        package.workbook.add_worksheet(name: "Timesheet") do |sheet|
          sheet.add_row CsvExporter::HEADERS
          period.timesheet_lines.includes(:employee).order(:work_date).each do |l|
            sheet.add_row [ l.employee.full_name, l.work_date.to_s, l.scheduled_minutes,
                            l.worked_minutes, l.break_minutes, l.flags.join("|") ]
          end
        end
        package.to_stream.read
      end
    end
  end
end
