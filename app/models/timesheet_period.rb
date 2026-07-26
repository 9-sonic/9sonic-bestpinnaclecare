class TimesheetPeriod < ApplicationRecord
  has_many   :timesheet_lines, dependent: :destroy
  belongs_to :approved_by, class_name: "Admin", foreign_key: :approved_by_admin_id, optional: true

  enum :status, { open: "open", approved: "approved", locked: "locked" }, default: "open"
end
