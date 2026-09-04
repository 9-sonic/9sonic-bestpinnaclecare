class VisitSerializer
  def self.call(visit, include_service_user: false)
    payload = {
      id:              visit.id,
      service_user_id: visit.service_user_id,
      scheduled_start: visit.scheduled_start&.iso8601,
      scheduled_end:   visit.scheduled_end&.iso8601,
      status:          visit.status,
      staff_required:  visit.staff_required,
      notes:           visit.notes,
      # Present only for visits generated from the recurring weekly template —
      # the rota uses this to show a "recurring" mark, distinct from a one-off.
      care_package_slot_id: visit.care_package_slot_id,
      run:             visit.run,
      published_at:    visit.published_at&.iso8601,
      # Only the active carer(s) on the visit — withdrawn/cancelled assignments
      # are history, not "who is on this visit". Including them made the rota show
      # a phantom carer and "Remove carer" act on an already-withdrawn record.
      assignments:     visit.visit_assignments.select { |va| va.assignment_status == "assigned" }.map { |va| assignment(va) }
    }
    payload[:service_user] = ServiceUserSerializer.call(visit.service_user) if include_service_user
    payload
  end

  # A light assignment shape for the rota: who is on the visit and its state.
  # Built inline (not via VisitAssignmentSerializer) so it never recurses back
  # into a full visit.
  def self.assignment(va)
    {
      id:                va.id,
      lifecycle_state:   va.lifecycle_state,
      assignment_status: va.assignment_status,
      actual_start:      va.actual_start&.iso8601,
      employee: va.employee && {
        id:                 va.employee.id,
        first_name:         va.employee.first_name,
        last_name:          va.employee.last_name,
        full_name:          [ va.employee.first_name, va.employee.last_name ].compact.join(" "),
        employee_reference: va.employee.employee_reference
      }
    }
  end
end
