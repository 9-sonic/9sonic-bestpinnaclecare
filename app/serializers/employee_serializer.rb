class EmployeeSerializer
  # include_private: emergency contact (office + self). include_pay: rates (self + finance).
  def self.call(employee, include_private: false, include_pay: false)
    payload = {
      id:                        employee.id,
      email:                     employee.email,
      first_name:                employee.first_name,
      last_name:                 employee.last_name,
      full_name:                 employee.full_name,
      phone:                     employee.phone,
      role:                      employee.role,
      employee_reference:        employee.employee_reference,
      contracted_hours_per_week: employee.contracted_hours_per_week&.to_f,
      active:                    employee.active,
      mfa_enabled:               employee.mfa_enabled
    }
    if include_private
      payload[:emergency_contact_name]  = employee.emergency_contact_name
      payload[:emergency_contact_phone] = employee.emergency_contact_phone
    end
    if include_pay
      payload[:hourly_rate_pence]  = employee.hourly_rate_pence
      payload[:mileage_rate_pence] = employee.mileage_rate_pence
    end
    payload
  end
end
