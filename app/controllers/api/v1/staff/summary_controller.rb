module Api
  module V1
    module Staff
      # GET /api/v1/staff/summary?from=&to= — headline numbers for Home/Overview.
      class SummaryController < BaseController
        def show
          from = parse_date(params[:from]) || Date.current.beginning_of_week
          to   = parse_date(params[:to]) || (from + 6)

          vas = current_employee.visit_assignments.assigned.joins(:visit)
                                .where(visits: { scheduled_start: from.beginning_of_day..to.end_of_day })
          lines = current_employee.timesheet_lines.where(work_date: from..to)

          by_visits = Array.new(7, 0)
          by_hours  = Array.new(7, 0)
          vas.includes(:visit).each { |va| by_visits[weekday(va.visit.scheduled_start.to_date)] += 1 }
          lines.each { |l| by_hours[weekday(l.work_date)] += l.worked_minutes }

          render json: {
            hours_worked_minutes: lines.sum(:worked_minutes),
            contracted_minutes:   (current_employee.contracted_hours_per_week.to_f * 60).round,
            visits_count:         vas.count,
            clients_count:        vas.distinct.count("visits.service_user_id"),
            miles:                current_employee.mileage_claims.where(travel_date: from..to).sum(:miles).to_f,
            by_weekday:           { hours: by_hours, visits: by_visits }
          }
        end

        private

        def weekday(date) = (date.wday.zero? ? 6 : date.wday - 1) # Mon=0 .. Sun=6

        def parse_date(str)
          Date.parse(str) if str.present?
        rescue ArgumentError, TypeError
          nil
        end
      end
    end
  end
end
