# The carers. Authenticates at /api/v1/staff/auth/login (employees table only).
class Employee < ApplicationRecord
  include Authenticatable

  enum :role, { carer: "carer", senior_carer: "senior_carer" }

  has_many :shift_assignments, dependent: :restrict_with_error
  has_many :shifts, through: :shift_assignments
  has_many :timesheet_lines
  has_many :raised_disputes, class_name: "TimesheetDispute", foreign_key: :raised_by_employee_id
end
