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
          scheduled_minutes = 0
          vas.includes(:visit).each do |va|
            by_visits[weekday(va.visit.scheduled_start.to_date)] += 1
            scheduled_minutes += ((va.visit.scheduled_end - va.visit.scheduled_start) / 60.0).round
          end
          lines.each { |l| by_hours[weekday(l.work_date)] += l.worked_minutes }

          render json: {
            hours_worked_minutes: lines.sum(:worked_minutes),
            # The real aggregate of this carer's rostered shift time for the
            # requested week — not a manually-typed HR figure, which drifts out
            # of date and was landing as 0 whenever nobody had entered one. nil
            # only when nothing is on the rota for them in this window at all,
            # so the frontend's "no data" fallback (40h) is reserved for a
            # carer with no assignments here rather than treated as normal.
            contracted_minutes:   vas.exists? ? scheduled_minutes : nil,
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
