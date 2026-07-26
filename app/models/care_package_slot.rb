# A recurring contracted call in a service user's care package (was ShiftTemplate).
# The nightly generator expands these into dated visits.
class CarePackageSlot < ApplicationRecord
  belongs_to :service_user
  has_many   :visits

  scope :active, -> { where(active: true) }
end
