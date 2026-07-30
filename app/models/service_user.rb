# The patient/client. Their home address is the geofence anchor for clock-in.
# Not an auth identity — no login in Phase 1.
class ServiceUser < ApplicationRecord
  geocoded_by :geocoding_address, latitude: :lat, longitude: :lng
  after_validation :geocode, if: :should_geocode?

  has_many :care_package_slots, dependent: :restrict_with_error
  has_many :visits,             dependent: :restrict_with_error
  has_many :care_plan_items,    dependent: :destroy

  scope :active, -> { where(active: true) }

  def full_name = "#{first_name} #{last_name}"

  def geocoding_address
    [ address_line1, address_line2, city, postcode ].compact_blank.join(", ")
  end

  private

  # Only geocode when we have an address, are missing coordinates, and the
  # address just changed — so admin-provided coords are never overwritten.
  def should_geocode?
    geocoding_address.present? && (lat.blank? || lng.blank?) &&
      (new_record? || will_save_change_to_address_line1? || will_save_change_to_city? || will_save_change_to_postcode?)
  end
end
