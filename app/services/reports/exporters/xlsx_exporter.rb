module Reports
  module Exporters
    # Generates a multi-sheet XLSX report pack from the same aggregates that
    # power the dashboard charts.
    class XlsxExporter
      def self.call(from:, to:)
        data = Reports::Build.call(from: from, to: to)
        su   = data[:summary]

        package = Axlsx::Package.new
        wb = package.workbook

        wb.add_worksheet(name: "Summary") do |sheet|
          sheet.add_row [ "Report Pack — #{data[:range][:from]} to #{data[:range][:to]}" ]
          sheet.add_row []
          sheet.add_row %w[metric value]
          sheet.add_row [ "attendance_pct", su[:attendance_pct] ]
          sheet.add_row [ "on_time_pct", su[:on_time_pct] ]
          sheet.add_row [ "completed", su[:completed] ]
          sheet.add_row [ "missed", su[:missed] ]
          sheet.add_row [ "unresolved", su[:unresolved] ]
          sheet.add_row [ "exceptions", su[:exceptions] ]
          sheet.add_row [ "scheduled_hours", su[:scheduled_hours] ]
          sheet.add_row [ "verified_hours", su[:verified_hours] ]
          sheet.add_row [ "break_hours", su[:break_hours] ]
          sheet.add_row [ "tasks_done", su[:tasks_done] ]
          sheet.add_row [ "tasks_total", su[:tasks_total] ]
          sheet.add_row [ "tasks_pct", su[:tasks_pct] ]
        end

        wb.add_worksheet(name: "Location at Clock-in") do |sheet|
          loc = data[:location] || {}
          sheet.add_row %w[metric value]
          %i[clock_ins on_site out_of_range no_gps_fix not_checked needs_review].each do |k|
            sheet.add_row [ k.to_s, loc[k] ]
          end
        end

        wb.add_worksheet(name: "Attendance by Day") do |sheet|
          sheet.add_row %w[date label on_time late missed]
          (data[:attendance_by_day] || []).each do |d|
            sheet.add_row [ d[:date], d[:label], d[:on_time], d[:late], d[:missed] ]
          end
        end

        wb.add_worksheet(name: "Hours by Carer") do |sheet|
          sheet.add_row %w[carer hours]
          (data[:hours_by_carer] || []).each do |h|
            sheet.add_row [ h[:name], h[:hours] ]
          end
        end

        wb.add_worksheet(name: "Exceptions by Day") do |sheet|
          sheet.add_row %w[date label count]
          (data[:exceptions_by_day] || []).each do |e|
            sheet.add_row [ e[:date], e[:label], e[:count] ]
          end
        end

        wb.add_worksheet(name: "Alerts by Severity") do |sheet|
          sheet.add_row %w[severity count]
          (data[:alerts_by_severity] || []).each do |a|
            sheet.add_row [ a[:severity], a[:count] ]
          end
        end

        wb.add_worksheet(name: "Late by Client") do |sheet|
          sheet.add_row %w[client visits late]
          (data[:late_by_client] || []).each do |l|
            sheet.add_row [ l[:client], l[:visits], l[:late] ]
          end
        end

        package.to_stream.read
      end
    end
  end
end
