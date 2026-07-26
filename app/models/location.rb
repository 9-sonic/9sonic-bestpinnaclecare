class Location < ApplicationRecord
  has_many :shift_templates
  has_many :shifts

  scope :active, -> { where(active: true) }
end
