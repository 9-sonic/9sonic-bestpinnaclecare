# Single-row, in-app-editable provider configuration (id is always 1).
class Setting < ApplicationRecord
  def self.instance = first_or_create!(id: 1)

  def geofence_for(service_user)
    # .presence so a blank ("") per-user mode falls back to the global setting
    # rather than being treated as a real value (which is neither "block" nor
    # "off", so it would silently stop enforcing).
    { mode:   service_user&.geofence_mode.presence || geofence_mode.presence || "block",
      radius: service_user&.geofence_radius_m || geofence_radius_m }
  end
end
