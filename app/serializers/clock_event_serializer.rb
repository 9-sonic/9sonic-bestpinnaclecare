class ClockEventSerializer
  def self.call(ce)
    {
      id:                   ce.id,
      kind:                 ce.kind,
      occurred_at:          ce.occurred_at&.iso8601,
      recorded_at:          ce.recorded_at&.iso8601,
      method:               ce.method,
      geofence_result:      ce.geofence_result,
      distance_from_site_m: ce.distance_from_site_m,
      client_event_id:      ce.client_event_id
    }
  end
end
