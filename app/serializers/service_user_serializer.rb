class ServiceUserSerializer
  def self.call(su)
    {
      id:                su.id,
      first_name:        su.first_name,
      last_name:         su.last_name,
      full_name:         su.full_name,
      reference:         su.reference,
      phone:             su.phone,
      address_line1:     su.address_line1,
      address_line2:     su.address_line2,
      city:              su.city,
      postcode:          su.postcode,
      lat:               su.lat&.to_f,
      lng:               su.lng&.to_f,
      geofence_radius_m: su.geofence_radius_m,
      geofence_mode:     su.geofence_mode,
      access_notes:      su.access_notes,
      active:            su.active
    }
  end
end
