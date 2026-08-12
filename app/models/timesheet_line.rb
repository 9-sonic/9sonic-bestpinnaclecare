class TimesheetLine < ApplicationRecord
  belongs_to :timesheet_period
  belongs_to :employee
  belongs_to :visit_assignment
  belongs_to :approved_by, class_name: "Admin", foreign_key: :approved_by_admin_id, optional: true
  has_many   :timesheet_disputes

  scope :approved,   -> { where.not(approved_at: nil) }
  scope :unapproved, -> { where(approved_at: nil) }

  def approved? = approved_at.present?
end
