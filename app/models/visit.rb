# One dated call to one service user's home (was Shift). Geofence = the service
# user's home; clock-in/out happen here per visit.
class Visit < ApplicationRecord
  belongs_to :service_user
  belongs_to :care_package_slot, optional: true
  belongs_to :published_by, class_name: "Admin", foreign_key: :published_by_admin_id, optional: true
  has_many   :visit_assignments, dependent: :destroy
  has_many   :employees, through: :visit_assignments

  enum :status, { draft: "draft", published: "published", cancelled: "cancelled" }
  scope :published, -> { where(status: :published) }

  validates :scheduled_end, comparison: { greater_than: :scheduled_start }
end
