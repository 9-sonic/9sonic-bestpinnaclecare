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
        location:           location,
        attendance_by_day:  attendance_by_day,
        hours_by_carer:     hours_by_carer,
        exceptions_by_day:  exceptions_by_day,
        alerts_by_severity: alerts_by_severity,
        late_by_client:     late_by_client,
        staffing:           staffing,
        cover_by_client:    cover_by_client,
        requests:           requests,
        requests_by_carer:  requests_by_carer,
        carer_reliability:  carer_reliability,
        care_delivery:      care_delivery,
        tasks_by_day:       tasks_by_day,
        care_by_client:     care_by_client,
        care_by_carer:      care_by_carer
      }
    end

    private

    def assignments
      @assignments ||= VisitAssignment
                       .joins(:visit)
                       .includes(:employee, :clock_events, :visit_tasks, visit: :service_user)
                       .where(visits: { scheduled_start: @from..@to })
                       .where.not(lifecycle_state: :cancelled)
                       .to_a
    end

    def completed = assignments.select { |a| a.lifecycle_state == "completed" }
    def missed    = assignments.select { |a| a.lifecycle_state == "missed" }
    # Visits the office still has to resolve — they must not be hidden from the
    # attendance picture, or a week can read 100% while work is unaccounted for.
    def unresolved = assignments.select { |a| %w[pending_review overdue].include?(a.lifecycle_state) }

    # Late if the carer clocked in more than the grace period after the start.
    def late?(a)
      return false unless a.actual_start && a.visit&.scheduled_start

      ((a.actual_start - a.visit.scheduled_start) / 60.0) > @grace
    end

    def summary
      done       = completed.size
      missed_ct  = missed.size
      unres_ct   = unresolved.size
      clocked    = completed.select(&:actual_start)
      on_time    = clocked.reject { |a| late?(a) }.size
      worked_min = completed.sum { |a| a.worked_minutes.to_i }
      break_min  = completed.sum { |a| a.break_minutes.to_i }
      sched_min  = completed.sum { |a| scheduled_min(a) }
      tasks      = completed.flat_map(&:visit_tasks)
      tasks_done = tasks.count(&:done)
      # Everything the office is accountable for in the range: delivered, missed,
      # or still to resolve. pending_review/overdue count against attendance so
      # the headline can't look perfect while visits are unaccounted for.
      denom = done + missed_ct + unres_ct

      {
        verified_hours:  (worked_min / 60.0).round(1),
        scheduled_hours: (sched_min / 60.0).round(1),
        break_hours:     (break_min / 60.0).round(1),
        # nil (not 100) when there's nothing to measure — an empty period has no
        # rate, and showing 100% reads as "perfect" when really no visits happened.
        # The dashboard renders nil as "—".
        attendance_pct:  denom.zero? ? nil : ((done.to_f / denom) * 100).round,
        on_time_pct:     clocked.empty? ? nil : ((on_time.to_f / clocked.size) * 100).round,
        unresolved:      unres_ct,
        missed:          missed_ct,
        completed:       done,
        tasks_total:     tasks.size,
        tasks_done:      tasks_done,
        tasks_pct:       tasks.empty? ? nil : ((tasks_done.to_f / tasks.size) * 100).round,
        exceptions:      alerts_in_range.size
      }
    end

    # Location integrity at clock-in — the core of an EVV product. Counts each
    # completed/unresolved visit's effective clock-in by geofence outcome, so the
    # office can see how many arrivals had a location problem.
    def location
      # Every visit that actually produced a clock-in, whatever its lifecycle
      # state now (in_progress, completed, pending_review …). A missed visit has
      # no clock-in, so it simply doesn't appear here.
      graded = assignments.filter_map(&:effective_clock_in)
      by_result = graded.group_by(&:geofence_result)
      {
        clock_ins:    graded.size,
        on_site:      (by_result["pass"] || []).size,
        out_of_range: (by_result["fail"] || []).size,
        no_gps_fix:   (by_result["no_fix"] || []).size,
        not_checked:  (by_result["not_checked"] || []).size,
        # Anything that isn't a clean on-site pass is worth the office's attention.
        needs_review: graded.count { |ce| ce.geofence_result != "pass" }
      }
    end

    def scheduled_min(a)
      return 0 unless a.visit&.scheduled_start && a.visit&.scheduled_end

      ((a.visit.scheduled_end - a.visit.scheduled_start) / 60.0).round
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

    # Complete, sorted — the dashboard caps for its chart; the export keeps all.
    def hours_by_carer
      completed.group_by(&:employee).map { |emp, list|
        { name: emp&.full_name || "—", hours: (list.sum { |a| a.worked_minutes.to_i } / 60.0).round(1) }
      }.sort_by { |h| -h[:hours] }
    end

    # Per-carer reliability over the period: how many of their visits were on
    # time, late or missed. A comparative view across the team (not a per-day
    # trend per carer, which doesn't scale to read) — sorted worst on-time rate
    # first, so the carer who most needs a conversation surfaces at the top.
    def carer_reliability
      assignments.group_by(&:employee).map { |emp, list|
        done      = list.select { |a| a.lifecycle_state == "completed" }
        missed_ct = list.count { |a| a.lifecycle_state == "missed" }
        late_ct   = done.count { |a| late?(a) }
        total     = done.size + missed_ct
        {
          carer:       emp.full_name,
          visits:      total,
          on_time:     done.size - late_ct,
          late:        late_ct,
          missed:      missed_ct,
          on_time_pct: done.empty? ? 100 : (((done.size - late_ct).to_f / done.size) * 100).round
        }
      }.select { |h| h[:visits].positive? }.sort_by { |h| h[:on_time_pct] }
    end

    # All care tasks recorded on visits in the range (from every assignment,
    # not only completed ones — an in-progress or pending-review visit's tasks
    # so far still count, the same principle as summary's denom).
    def all_tasks
      @all_tasks ||= assignments.flat_map(&:visit_tasks)
    end

    # The real, current note per thread — VisitNote.effective already excludes
    # anything superseded by a later edit; scoping straight to it here is
    # simpler and more honest than re-deriving "not superseded" in Ruby from
    # the already-loaded (and possibly stale/incomplete) association.
    def all_notes
      @all_notes ||= VisitNote.effective.where(visit_assignment_id: assignments.map(&:id)).to_a
    end

    # Care delivery headline: task completion and note volume across the
    # period — the depth behind the single tasks_pct tile in summary.
    def care_delivery
      done = all_tasks.count(&:done)
      {
        tasks_total:       all_tasks.size,
        tasks_done:        done,
        tasks_pct:         all_tasks.empty? ? 100 : ((done.to_f / all_tasks.size) * 100).round,
        notes_recorded:    all_notes.size,
        visits_with_notes: all_notes.map(&:visit_assignment_id).uniq.size
      }
    end

    # Task completion trend across the period, same bucketing as attendance.
    def tasks_by_day
      buckets.map do |b|
        day_tasks = assignments.select { |a| b[:range].cover?(a.visit.scheduled_start.to_date) }.flat_map(&:visit_tasks)
        done = day_tasks.count(&:done)
        { label: b[:label], date: b[:date], total: day_tasks.size, done: done,
          pct: day_tasks.empty? ? 100 : ((done.to_f / day_tasks.size) * 100).round }
      end
    end

    # Task completion by client — where care delivery is falling short, by
    # the person it affects.
    def care_by_client
      assignments.group_by { |a| a.visit.service_user }.filter_map { |su, list|
        tasks = list.flat_map(&:visit_tasks)
        next if tasks.empty?

        done = tasks.count(&:done)
        { client: su&.full_name || "—", tasks_total: tasks.size, tasks_done: done, tasks_pct: ((done.to_f / tasks.size) * 100).round }
      }.sort_by { |h| h[:tasks_pct] }
    end

    # Task completion by carer — a comparative view alongside carer_reliability.
    def care_by_carer
      assignments.group_by(&:employee).filter_map { |emp, list|
        tasks = list.flat_map(&:visit_tasks)
        next if tasks.empty?

        done = tasks.count(&:done)
        { carer: emp.full_name, tasks_total: tasks.size, tasks_done: done, tasks_pct: ((done.to_f / tasks.size) * 100).round }
      }.sort_by { |h| h[:tasks_pct] }
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
      }.select { |h| h[:late].positive? }.sort_by { |h| -h[:late] }
    end

    # Every published visit whose scheduled start falls in the range, plus
    # whichever cover offers were raised for it (an offer can be raised before
    # the range if the visit itself starts inside it — @cover_offers is keyed
    # by visit_id, not filtered by offered_at, so a late-raised or early-raised
    # offer for an in-range visit is still counted against that visit).
    def staffing_visits
      @staffing_visits ||= Visit.published
                                 .where(scheduled_start: @from..@to)
                                 .includes(:service_user, :visit_assignments)
                                 .to_a
    end

    def cover_offers_by_visit
      @cover_offers_by_visit ||= CoverOffer.where(visit_id: staffing_visits.map(&:id))
                                            .group_by(&:visit_id)
    end

    def filled?(visit)
      visit.visit_assignments.count { |a| a.assignment_status == "assigned" && a.lifecycle_state != "cancelled" } >= visit.staff_required
    end

    # Staffing/cover health: how much of the period needed the cover board at
    # all, how much of that got filled, and how long it took once offered.
    def staffing
      needed_cover = staffing_visits.select { |v| cover_offers_by_visit[v.id].present? }
      filled_via_cover = needed_cover.select { |v| filled?(v) }

      fill_times = needed_cover.filter_map { |v|
        accepted = cover_offers_by_visit[v.id].find { |o| o.state == "accepted" }
        next unless accepted&.responded_at && accepted.offered_at

        (accepted.responded_at - accepted.offered_at) / 60.0
      }

      {
        total_visits:         staffing_visits.size,
        needed_cover:         needed_cover.size,
        filled:               filled_via_cover.size,
        still_unfilled:       needed_cover.size - filled_via_cover.size,
        cover_rate_pct:       staffing_visits.empty? ? 0 : ((needed_cover.size.to_f / staffing_visits.size) * 100).round,
        fill_rate_pct:        needed_cover.empty? ? 100 : ((filled_via_cover.size.to_f / needed_cover.size) * 100).round,
        avg_time_to_fill_min: fill_times.empty? ? nil : (fill_times.sum / fill_times.size).round
      }
    end

    # Which clients' visits most often needed the cover board — the chronically
    # hard-to-staff slots worth the office's attention.
    def cover_by_client
      staffing_visits.select { |v| cover_offers_by_visit[v.id].present? }
                      .group_by(&:service_user)
                      .map { |su, list|
                        { client: su&.full_name || "—", visits: list.size, unfilled: list.count { |v| !filled?(v) } }
                      }.sort_by { |h| -h[:visits] }
    end

    def alerts_in_range
      @alerts_in_range ||= Alert.where(raised_at: @from..@to).to_a
    end

    # Requests raised in the range (drop),
    # keyed by when the carer raised them — not when they were decided, so a
    # request raised at the end of one period and decided in the next still
    # shows up in the period it was actually asked in.
    def requests_in_range
      @requests_in_range ||= CarerRequest.includes(:employee).where(created_at: @from..@to).to_a
    end

    def decided_requests
      requests_in_range.select { |r| %w[approved declined].include?(r.state) }
    end

    # Volume by kind, approval rate, and average turnaround from raised to
    # decided — how responsive the office is to what carers are asking for.
    def requests
      by_kind = requests_in_range.group_by(&:kind).transform_values(&:size)
      turnaround = decided_requests.filter_map { |r|
        next unless r.decided_at

        (r.decided_at - r.created_at) / 3600.0
      }

      {
        total:                requests_in_range.size,
        pending:              requests_in_range.count { |r| r.state == "pending" },
        approved:             requests_in_range.count { |r| r.state == "approved" },
        declined:             requests_in_range.count { |r| r.state == "declined" },
        approval_rate_pct:    decided_requests.empty? ? 0 : ((decided_requests.count { |r| r.state == "approved" }.to_f / decided_requests.size) * 100).round,
        avg_turnaround_hours: turnaround.empty? ? nil : (turnaround.sum / turnaround.size).round(1),
        by_kind:              CarerRequest::KINDS.map { |k| { kind: k, count: by_kind[k] || 0 } }
      }
    end

    # Which carers are raising the most requests — useful both as "who needs
    # support" and "who's asking to drop most often."
    def requests_by_carer
      requests_in_range.group_by(&:employee).map { |emp, list|
        { carer: emp&.full_name || "—", total: list.size, pending: list.count { |r| r.state == "pending" } }
      }.sort_by { |h| -h[:total] }
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
