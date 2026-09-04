module Assignments
  # Soft, non-blocking checks run when assigning a carer to a visit. Returns an
  # array of warnings the office sees; it never prevents the assignment.
  class Validate
    REST_HOURS = 11

    def self.call(visit:, employee:)
      others = employee.visit_assignments.assigned.non_terminal.includes(:visit).to_a.reject { |va| va.visit_id == visit.id }
      [ rest(visit, others) ].compact
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

    def self.rest(visit, others)
      prev_end = others.map { |va| va.visit.scheduled_end }.select { |e| e <= visit.scheduled_start }.max
      return unless prev_end && (visit.scheduled_start - prev_end) < REST_HOURS.hours

      warn("rest_period", "Less than #{REST_HOURS}h rest since the previous visit")
    end

    def self.warn(code, message) = { code: code, message: message }
  end
end
