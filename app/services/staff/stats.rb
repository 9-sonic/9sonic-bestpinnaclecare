module Staff
  # Per-carer metrics computed from real clock/timesheet data — hours worked this
  # week, punctuality over the last 30 days, and their usual capture method.
  # Returns a hash keyed by employee_id. No invented HR data (teams, compliance).
  class Stats
    def self.call
      new.call
    end

    def call
      ids = Employee.pluck(:id)
      hours = hours_this_week
      punct = punctuality_30d
      methods = capture_methods

      ids.index_with do |id|
        on, total = punct[id] || [ 0, 0 ]
        {
          hours_this_week: (hours[id].to_i / 60.0).round(1),
          punctuality:     total.zero? ? nil : ((on.to_f / total) * 100).round,
          capture_method:  methods[id]
        }
      end
    end

    private

    def grace = @grace ||= Setting.instance.late_grace_minutes.to_i

    def hours_this_week
      week = Date.current.beginning_of_week
      VisitAssignment.completed.joins(:visit)
                     .where(visits: { scheduled_start: week.beginning_of_day..(week + 6).end_of_day })
                     .group(:employee_id).sum(:worked_minutes)
    end

    # [on_time, total] per employee over completed, clocked-in visits in 30 days.
    def punctuality_30d
      rows = VisitAssignment.completed.joins(:visit)
                            .where(visits: { scheduled_start: 30.days.ago.. })
                            .where.not(actual_start: nil)
                            .pluck(:employee_id, :actual_start, "visits.scheduled_start")
      acc = Hash.new { |h, k| h[k] = [ 0, 0 ] }
      rows.each do |emp, actual, scheduled|
        acc[emp][1] += 1
        acc[emp][0] += 1 if actual <= scheduled + grace.minutes
      end
      acc
    end

    def capture_methods
      counts = ClockEvent.where(kind: :clock_in).joins(:visit_assignment)
                         .group("visit_assignments.employee_id", :method).count
      best = {}
      counts.each do |(emp, method), n|
        best[emp] = [ method, n ] if best[emp].nil? || n > best[emp][1]
      end
      best.transform_values(&:first)
    end
  end
end
