# The office. Authenticates at /api/v1/admin/auth/login (admins table only).
class Admin < ApplicationRecord
  include Authenticatable

  enum :role, {
    registered_manager: "registered_manager", manager: "manager", coordinator: "coordinator",
    finance: "finance", auditor: "auditor"
  }

  has_many :published_visits,           class_name: "Visit",           foreign_key: :published_by_admin_id
  has_many :assigned_visit_assignments, class_name: "VisitAssignment", foreign_key: :assigned_by_admin_id
  has_many :approved_periods,           class_name: "TimesheetPeriod", foreign_key: :approved_by_admin_id
  has_many :acknowledged_alerts,        class_name: "Alert",           foreign_key: :acknowledged_by_admin_id
end
