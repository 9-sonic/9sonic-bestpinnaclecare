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

          by_visits = Array.new(7, 0)
          by_hours  = Array.new(7, 0)
          scheduled_minutes = 0
          loaded = vas.includes(:visit).to_a
          loaded.each do |va|
            day = weekday(va.visit.scheduled_start.to_date)
            by_visits[day] += 1
            scheduled_minutes += ((va.visit.scheduled_end - va.visit.scheduled_start) / 60.0).round
          end
          # Hours worked are merged per day and for the week: a carer covering a
          # couple at one address is clocked into two visits for the same half
          # hour, and that is half an hour of their time, not an hour.
          loaded.group_by { |va| weekday(va.visit.scheduled_start.to_date) }
                .each { |day, list| by_hours[day] = Assignments::WorkedTime.minutes(list) }
          worked_minutes = Assignments::WorkedTime.minutes(loaded)

          render json: {
            hours_worked_minutes: worked_minutes,
            # The aggregate of this carer's scheduled shift time for the week —
            # the "target" the worked hours are measured against on the Home
            # ring. nil only when nothing is on their rota this window at all.
            scheduled_minutes:    vas.exists? ? scheduled_minutes : nil,
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
