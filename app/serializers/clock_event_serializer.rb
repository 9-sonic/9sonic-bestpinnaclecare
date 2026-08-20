class ClockEventSerializer
  def self.call(ce)
    {
      id:                   ce.id,
      kind:                 ce.kind,
      occurred_at:          ce.occurred_at&.iso8601,
      recorded_at:          ce.recorded_at&.iso8601,
      method:               ce.method,
      origin:               ce.origin,
      geofence_result:      ce.geofence_result,
      distance_from_site_m: ce.distance_from_site_m,
      client_event_id:      ce.client_event_id,
      # Provenance of the tap — the device it came from and the IP it arrived on.
      device:     device_json(ce),
      ip_address: ce.ip_address
    }
  end

  def self.device_json(ce)
    return nil if ce.device_fingerprint.blank?

    d = ce.device
    {
      fingerprint: ce.device_fingerprint,
      platform:    d&.platform,
      app_version: d&.app_version
    }
  end
end
