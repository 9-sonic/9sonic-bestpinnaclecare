module Reports
  # Aggregates clocking performance over a date range from existing records —
  # no new tables. Team/region are deliberately absent from the data model, so
  # breakdowns are by carer and by client (person), never by an invented team.
  class Build
    def self.call(from:, to:)
      new(from, to).call
    end

    def initialize(from, to)
      @from  = from
      @to    = to
      @grace = Setting.instance.late_grace_minutes.to_i
    end

    def call
      {
        range:              { from: @from.iso8601, to: @to.iso8601 },
        summary:            summary,
        attendance_by_day:  attendance_by_day,
        hours_by_carer:     hours_by_carer,
        exceptions_by_day:  exceptions_by_day,
        alerts_by_severity: alerts_by_severity,
        late_by_client:     late_by_client
      }
    end

    private

    def assignments
      @assignments ||= VisitAssignment
                       .joins(:visit)
                       .includes(:employee, visit: :service_user)
                       .where(visits: { scheduled_start: @from..@to })
                       .where.not(lifecycle_state: :cancelled)
                       .to_a
    end

    def completed = assignments.select { |a| a.lifecycle_state == "completed" }
    def missed    = assignments.select { |a| a.lifecycle_state == "missed" }

    # Late if the carer clocked in more than the grace period after the start.
    def late?(a)
      return false unless a.actual_start && a.visit&.scheduled_start

      ((a.actual_start - a.visit.scheduled_start) / 60.0) > @grace
    end

    def summary
      done      = completed.size
      missed_ct = missed.size
      clocked   = completed.select(&:actual_start)
      on_time   = clocked.reject { |a| late?(a) }.size
      hours     = completed.sum { |a| a.worked_minutes.to_i } / 60.0
      denom     = done + missed_ct

      {
        verified_hours: hours.round(1),
        attendance_pct: denom.zero? ? 100 : ((done.to_f / denom) * 100).round,
        on_time_pct:    clocked.empty? ? 100 : ((on_time.to_f / clocked.size) * 100).round,
        exceptions:     alerts_in_range.size
      }
    end

    def attendance_by_day
      buckets.map do |b|
        day_asg = assignments.select { |a| b[:range].cover?(a.visit.scheduled_start.to_date) }
        done    = day_asg.select { |a| a.lifecycle_state == "completed" }
        {
          label:   b[:label],
          date:    b[:date],
          on_time: done.reject { |a| late?(a) }.size,
          late:    done.select { |a| late?(a) }.size,
          missed:  day_asg.count { |a| a.lifecycle_state == "missed" }
        }
      end
    end

    def hours_by_carer
      completed.group_by(&:employee).map { |emp, list|
        { name: emp&.full_name || "—", hours: (list.sum { |a| a.worked_minutes.to_i } / 60.0).round(1) }
      }.sort_by { |h| -h[:hours] }.first(8)
    end

    def exceptions_by_day
      buckets.map do |b|
        count = alerts_in_range.count { |al| b[:range].cover?(al.raised_at.to_date) }
        { label: b[:label], date: b[:date], count: count }
      end
    end

    def alerts_by_severity
      alerts_in_range.group_by(&:severity).map { |sev, list| { severity: sev, count: list.size } }
    end

    def late_by_client
      completed.group_by { |a| a.visit.service_user }.map { |su, list|
        { client: su&.full_name || "—", visits: list.size, late: list.count { |a| late?(a) } }
      }.select { |h| h[:late].positive? }.sort_by { |h| -h[:late] }.first(6)
    end

    def alerts_in_range
      @alerts_in_range ||= Alert.where(raised_at: @from..@to).to_a
    end

    # Buckets the range so it stays readable at any span: a day each for up to a
    # fortnight (the weekly view), a week each up to ~six months (the monthly
    # view), a month each beyond that (the yearly view). Each bucket carries an
    # inclusive date range and an axis label. Response shape is unchanged, so the
    # charts render whatever granularity they're handed.
    def buckets
      @buckets ||= begin
        from_d = @from.to_date
        to_d   = @to.to_date
        span   = (to_d - from_d).to_i + 1

        if span <= 14
          (from_d..to_d).map { |d| bucket(d, d, d.strftime("%a")) }
        elsif span <= 180
          step(from_d, to_d, :beginning_of_week, 7) { |s| s.strftime("%-d %b") }
        else
          step(from_d, to_d, :beginning_of_month, :month) { |s| s.strftime("%b %y") }
        end
      end
    end

    # Walks aligned periods (week/month) across [from_d, to_d], clamping the
    # first and last to the actual range, labelling each by its true start.
    def step(from_d, to_d, align, advance)
      result = []
      cursor = from_d.public_send(align)
      while cursor <= to_d
        start  = [ cursor, from_d ].max
        finish = advance == :month ? [ cursor.end_of_month, to_d ].min : [ cursor + (advance - 1), to_d ].min
        result << bucket(start, finish, yield(start))
        cursor = advance == :month ? cursor.next_month : cursor + advance
      end
      result
    end

    def bucket(start, finish, label)
      { range: start..finish, date: start.iso8601, label: label }
    end
  end
end
