require "csv"

module Timesheets
  module Exporters
    class CsvExporter
      HEADERS = %w[employee work_date scheduled_minutes worked_minutes break_minutes flags].freeze

      def self.call(period)
        CSV.generate do |csv|
          csv << HEADERS
          period.timesheet_lines.includes(:employee).order(:work_date).each do |l|
            csv << [ l.employee.full_name, l.work_date, l.scheduled_minutes, l.worked_minutes, l.break_minutes, l.flags.join("|") ]
          end
        end
      end
    end
  end
end
