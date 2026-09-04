module Assignments
  # Soft, non-blocking checks run when assigning a carer to a visit. Returns an
  # array of warnings the office sees; it never prevents the assignment.
  class Validate
    REST_HOURS  = 11
    WEEKLY_MAX_H = 48

    def self.call(visit:, employee:)
      others = employee.visit_assignments.assigned.non_terminal.includes(:visit).to_a.reject { |va| va.visit_id == visit.id }
      [ overlap(visit, others), rest(visit, others), weekly(visit, others) ].compact
    end

    # The carer's own visit that clashes in time with this one, or nil. Used to
    # refuse a double-booking — but ONLY where the provider has that policy on
    # (Setting#allow_carer_double_booking?, which ships allowing it). Same
    # time-window logic as the soft `overlap` warning, so the refusal and the
    # warning can never disagree. Excludes this visit's own existing assignment.
    def self.conflicting_visit(visit:, employee:)
      employee.visit_assignments.assigned.non_terminal.includes(:visit).to_a
              .reject { |va| va.visit_id == visit.id }
              .find { |va| va.visit.scheduled_start < visit.scheduled_end && visit.scheduled_start < va.visit.scheduled_end }
    end

    # One service user, one carer at a time: the client's OTHER assigned visit
    # that clashes in time with this one, or nil. Used to HARD-BLOCK putting a
    # second carer on a client during a window they're already being visited —
    # a client can't be in two visits at once. Excludes this visit itself.
    def self.client_conflict(visit:)
      VisitAssignment.assigned.non_terminal
                     .joins(:visit)
                     .where(visits: { service_user_id: visit.service_user_id })
                     .where.not(visit_id: visit.id)
                     .includes(:visit)
                     .find { |va| va.visit.scheduled_start < visit.scheduled_end && visit.scheduled_start < va.visit.scheduled_end }
    end

    def self.overlap(visit, others)
      clash = others.any? { |va| va.visit.scheduled_start < visit.scheduled_end && visit.scheduled_start < va.visit.scheduled_end }
      warn("overlap", "Overlaps another assigned visit") if clash
    end

    def self.rest(visit, others)
      prev_end = others.map { |va| va.visit.scheduled_end }.select { |e| e <= visit.scheduled_start }.max
      return unless prev_end && (visit.scheduled_start - prev_end) < REST_HOURS.hours

      warn("rest_period", "Less than #{REST_HOURS}h rest since the previous visit")
    end

    def self.weekly(visit, others)
      wk = visit.scheduled_start.beginning_of_week
      minutes = others.select { |va| va.visit.scheduled_start >= wk && va.visit.scheduled_start < wk + 7.days }
                      .sum { |va| duration_min(va.visit) }
      minutes += duration_min(visit)
      warn("weekly_hours", "Exceeds #{WEEKLY_MAX_H}h scheduled this week") if minutes > WEEKLY_MAX_H * 60
    end

    def self.duration_min(v) = ((v.scheduled_end - v.scheduled_start) / 60).to_i
    def self.warn(code, message) = { code: code, message: message }
  end
end
