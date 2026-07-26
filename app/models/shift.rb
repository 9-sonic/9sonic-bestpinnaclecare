class Shift < ApplicationRecord
  belongs_to :shift_template, optional: true
  belongs_to :location, optional: true
  belongs_to :published_by, class_name: "Admin", foreign_key: :published_by_admin_id, optional: true
  has_many   :shift_assignments, dependent: :destroy
  has_many   :employees, through: :shift_assignments

  enum :status, { draft: "draft", published: "published", cancelled: "cancelled" }
  scope :published, -> { where(status: :published) }

  validates :scheduled_end, comparison: { greater_than: :scheduled_start }
end
