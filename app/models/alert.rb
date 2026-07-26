# An operational condition an admin must act on. Deduped while open on (subject, alert_type).
class Alert < ApplicationRecord
  belongs_to :subject, polymorphic: true
  belongs_to :acknowledged_by, class_name: "Admin", foreign_key: :acknowledged_by_admin_id, optional: true
  has_many   :notifications

  enum :state, { open: "open", acknowledged: "acknowledged", resolved: "resolved" }

  scope :open_for, ->(s) { where(subject: s, state: :open) }
end
