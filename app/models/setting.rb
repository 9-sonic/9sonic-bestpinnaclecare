# Single-row, in-app-editable provider configuration (id is always 1).
class Setting < ApplicationRecord
  def self.instance = first_or_create!(id: 1)

  def geofence_for(service_user)
    { mode:   service_user&.geofence_mode   || geofence_mode,
      radius: service_user&.geofence_radius_m || geofence_radius_m }
  end
end
