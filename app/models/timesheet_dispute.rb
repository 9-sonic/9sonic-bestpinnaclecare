class TimesheetDispute < ApplicationRecord
  belongs_to :timesheet_line
  belongs_to :raised_by,   class_name: "Employee", foreign_key: :raised_by_employee_id
  belongs_to :resolved_by, class_name: "Admin",    foreign_key: :resolved_by_admin_id, optional: true
end
