class VisitAssignmentSerializer
  # include_employee adds the carer object (id + name) so screens that show
  # "who" — the live board, the exceptions queue — don't have to dig it out of
  # the nested visit.assignments array.
  def self.call(va, include_service_user: false, include_employee: false)
    payload = {
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
    if include_employee && va.employee
      payload[:employee] = {
        id: va.employee.id, first_name: va.employee.first_name,
        last_name: va.employee.last_name, full_name: va.employee.full_name
      }
    end
    payload
  end
end
