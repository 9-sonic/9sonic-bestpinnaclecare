class TimesheetLine < ApplicationRecord
  belongs_to :timesheet_period
  belongs_to :employee
  belongs_to :shift_assignment
  has_many   :timesheet_disputes
end
