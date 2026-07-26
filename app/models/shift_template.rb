class ShiftTemplate < ApplicationRecord
  belongs_to :location, optional: true
  has_many   :shifts

  scope :active, -> { where(active: true) }
end
