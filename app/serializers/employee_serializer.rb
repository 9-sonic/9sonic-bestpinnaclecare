class EmployeeSerializer
  def self.call(employee)
    {
      id:                 employee.id,
      email:              employee.email,
      first_name:         employee.first_name,
      last_name:          employee.last_name,
      full_name:          employee.full_name,
      role:               employee.role,
      employee_reference: employee.employee_reference,
      active:             employee.active,
      mfa_enabled:        employee.mfa_enabled
    }
  end
end
