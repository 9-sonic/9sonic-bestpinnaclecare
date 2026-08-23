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
          csv << []

          # Staffing / cover health
          csv << %w[metric value]
          st = data[:staffing] || {}
          csv << [ "total_visits", st[:total_visits] ]
          csv << [ "needed_cover", st[:needed_cover] ]
          csv << [ "filled", st[:filled] ]
          csv << [ "still_unfilled", st[:still_unfilled] ]
          csv << [ "cover_rate_pct", st[:cover_rate_pct] ]
          csv << [ "fill_rate_pct", st[:fill_rate_pct] ]
          csv << [ "avg_time_to_fill_min", st[:avg_time_to_fill_min] ]
          csv << []

          # Cover needed by client
          csv << %w[client visits unfilled]
          (data[:cover_by_client] || []).each do |c|
            csv << [ c[:client], c[:visits], c[:unfilled] ]
          end
          csv << []

          # Carer requests (drop)
          csv << %w[metric value]
          rq = data[:requests] || {}
          csv << [ "total", rq[:total] ]
          csv << [ "pending", rq[:pending] ]
          csv << [ "approved", rq[:approved] ]
          csv << [ "declined", rq[:declined] ]
          csv << [ "approval_rate_pct", rq[:approval_rate_pct] ]
          csv << [ "avg_turnaround_hours", rq[:avg_turnaround_hours] ]
          csv << []
          csv << %w[kind count]
          (rq[:by_kind] || []).each do |k|
            csv << [ k[:kind], k[:count] ]
          end
          csv << []

          # Requests by carer
          csv << %w[carer total pending]
          (data[:requests_by_carer] || []).each do |r|
            csv << [ r[:carer], r[:total], r[:pending] ]
          end
          csv << []

          # Carer reliability
          csv << %w[carer visits on_time late missed on_time_pct]
          (data[:carer_reliability] || []).each do |c|
            csv << [ c[:carer], c[:visits], c[:on_time], c[:late], c[:missed], c[:on_time_pct] ]
          end
          csv << []

          # Care delivery
          csv << %w[metric value]
          cd = data[:care_delivery] || {}
          csv << [ "tasks_total", cd[:tasks_total] ]
          csv << [ "tasks_done", cd[:tasks_done] ]
          csv << [ "tasks_pct", cd[:tasks_pct] ]
          csv << [ "notes_recorded", cd[:notes_recorded] ]
          csv << [ "visits_with_notes", cd[:visits_with_notes] ]
          csv << []

          # Task completion by day
          csv << %w[date label total done pct]
          (data[:tasks_by_day] || []).each do |d|
            csv << [ d[:date], d[:label], d[:total], d[:done], d[:pct] ]
          end
          csv << []

          # Care delivery by client
          csv << %w[client tasks_total tasks_done tasks_pct]
          (data[:care_by_client] || []).each do |c|
            csv << [ c[:client], c[:tasks_total], c[:tasks_done], c[:tasks_pct] ]
          end
          csv << []

          # Care delivery by carer
          csv << %w[carer tasks_total tasks_done tasks_pct]
          (data[:care_by_carer] || []).each do |c|
            csv << [ c[:carer], c[:tasks_total], c[:tasks_done], c[:tasks_pct] ]
          end
        end
      end
    end
  end
end
