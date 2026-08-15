module Clocking
  # Server-authoritative geofence decision for a clock-in at a service user's home.
  # Never trusts the client's own result.
  class EvaluateGeofence
    Result = Struct.new(:result, :distance_m, :blocked, keyword_init: true)

    # The geofence is always enforced: a carer may only clock in at the client's
    # address, within a fixed radius. A tap outside the fence is refused (blocked).
    # The only time we can't check is a missing GPS fix (no_fix) or a client with
    # no coordinates (not_checked) — neither is blocked, so care is never trapped
    # by a bad signal or incomplete data.
    #
    # result: pass | fail | no_fix | not_checked
    def self.call(service_user:, lat:, lng:, settings: Setting.instance)
      radius = settings.geofence_for(service_user)[:radius]

      return Result.new(result: "no_fix",      distance_m: nil, blocked: false) if lat.nil? || lng.nil?
      if service_user.lat.nil? || service_user.lng.nil?
        return Result.new(result: "not_checked", distance_m: nil, blocked: false)
      end

      distance = Geo::Haversine.distance_m(lat, lng, service_user.lat, service_user.lng)
      if distance <= radius
        Result.new(result: "pass", distance_m: distance, blocked: false)
      else
        Result.new(result: "fail", distance_m: distance, blocked: true)
      end
    end
  end
end
