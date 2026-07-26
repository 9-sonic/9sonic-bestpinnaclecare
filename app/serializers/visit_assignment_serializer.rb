class VisitAssignmentSerializer
  def self.call(va, include_service_user: false)
    {
      id:                va.id,
      visit_id:          va.visit_id,
      employee_id:       va.employee_id,
      lifecycle_state:   va.lifecycle_state,
      assignment_status: va.assignment_status,
      actual_start:      va.actual_start&.iso8601,
      actual_end:        va.actual_end&.iso8601,
      worked_minutes:    va.worked_minutes,
      flags:             va.flags,
      visit:             VisitSerializer.call(va.visit, include_service_user: include_service_user)
    }
  end
end
