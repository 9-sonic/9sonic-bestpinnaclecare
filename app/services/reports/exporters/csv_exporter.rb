require "csv"

module Reports
  module Exporters
    # Generates a multi-section CSV report pack from the same aggregates that
    # power the dashboard charts. Each section has a header row, then data.
    class CsvExporter
      def self.call(from:, to:)
        data = Reports::Build.call(from: from, to: to)

        CSV.generate do |csv|
          csv << [ "Report Pack — #{data[:range][:from]} to #{data[:range][:to]}" ]
          csv << []

          # Summary
          csv << %w[metric value]
          su = data[:summary]
          csv << [ "attendance_pct", su[:attendance_pct] ]
          csv << [ "on_time_pct", su[:on_time_pct] ]
          csv << [ "completed", su[:completed] ]
          csv << [ "missed", su[:missed] ]
          csv << [ "unresolved", su[:unresolved] ]
          csv << [ "exceptions", su[:exceptions] ]
          csv << [ "scheduled_hours", su[:scheduled_hours] ]
          csv << [ "verified_hours", su[:verified_hours] ]
          csv << [ "break_hours", su[:break_hours] ]
          csv << [ "tasks_done", su[:tasks_done] ]
          csv << [ "tasks_total", su[:tasks_total] ]
          csv << [ "tasks_pct", su[:tasks_pct] ]
          csv << []

          # Location at clock-in (geofence integrity)
          csv << %w[metric value]
          loc = data[:location] || {}
          csv << [ "clock_ins", loc[:clock_ins] ]
          csv << [ "on_site", loc[:on_site] ]
          csv << [ "out_of_range", loc[:out_of_range] ]
          csv << [ "no_gps_fix", loc[:no_gps_fix] ]
          csv << [ "not_checked", loc[:not_checked] ]
          csv << [ "needs_review", loc[:needs_review] ]
          csv << []

          # Attendance by day
          csv << %w[date label on_time late missed]
          (data[:attendance_by_day] || []).each do |d|
            csv << [ d[:date], d[:label], d[:on_time], d[:late], d[:missed] ]
          end
          csv << []

          # Hours by carer
          csv << %w[carer hours]
          (data[:hours_by_carer] || []).each do |h|
            csv << [ h[:name], h[:hours] ]
          end
          csv << []

          # Exceptions by day
          csv << %w[date label count]
          (data[:exceptions_by_day] || []).each do |e|
            csv << [ e[:date], e[:label], e[:count] ]
          end
          csv << []

          # Alerts by severity
          csv << %w[severity count]
          (data[:alerts_by_severity] || []).each do |a|
            csv << [ a[:severity], a[:count] ]
          end
          csv << []

          # Late by client
          csv << %w[client visits late]
          (data[:late_by_client] || []).each do |l|
            csv << [ l[:client], l[:visits], l[:late] ]
          end
        end
      end
    end
  end
end
