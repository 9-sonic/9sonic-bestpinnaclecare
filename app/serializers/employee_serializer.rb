class EmployeeSerializer
  # include_private: emergency contact (office + self).
  def self.call(employee, include_private: false)
    payload = {
      id:                        employee.id,
      email:                     employee.email,
      first_name:                employee.first_name,
      last_name:                 employee.last_name,
      full_name:                 employee.full_name,
      phone:                     employee.phone,
      avatar_url:                AttachmentUrl.for(employee.avatar),
      role:                      employee.role,
      employee_reference:        employee.employee_reference,
      contracted_hours_per_week: employee.contracted_hours_per_week&.to_f,
      active:                    employee.active,
      mfa_enabled:               employee.mfa_enabled,
      # Invited but not yet accepted — drives the "Resend invite" action.
      invite_pending:            employee.invited_at.present? && employee.accepted_invite_at.nil?
    }
    if include_private
      payload[:emergency_contact_name]  = employee.emergency_contact_name
      payload[:emergency_contact_phone] = employee.emergency_contact_phone
    end
    payload
  end
end
