# The patient/client. Their home address is the geofence anchor for clock-in.
# Not an auth identity — no login in Phase 1.
class ServiceUser < ApplicationRecord
  geocoded_by :geocoding_address, latitude: :lat, longitude: :lng
  after_validation :geocode, if: :should_geocode?

  has_many :care_package_slots, dependent: :restrict_with_error
  has_many :visits,             dependent: :restrict_with_error
  has_many :care_plan_items,    dependent: :destroy

  scope :active, -> { where(active: true) }

  # Give every client a stable reference when one isn't supplied — SU- plus a
  # short unique suffix (e.g. SU-A1B2C3D4), matching the existing SU- convention.
  before_create :assign_reference

  def full_name = "#{first_name} #{last_name}"

  def geocoding_address
    [ address_line1, address_line2, city, postcode ].compact_blank.join(", ")
  end

  private

  def assign_reference
    return if reference.present?

    self.reference = "SU-#{SecureRandom.hex(4).upcase}"
  end

  # Only geocode when we have an address, are missing coordinates, and the
  # address just changed — so admin-provided coords are never overwritten.
  def should_geocode?
    geocoding_address.present? && (lat.blank? || lng.blank?) &&
      (new_record? || will_save_change_to_address_line1? || will_save_change_to_city? || will_save_change_to_postcode?)
  end
end
