module Geo
  # Great-circle distance in metres between two lat/lng points.
  class Haversine
    EARTH_RADIUS_M = 6_371_000.0

    def self.distance_m(lat1, lng1, lat2, lng2)
      return nil if [ lat1, lng1, lat2, lng2 ].any?(&:nil?)

      rad = ->(d) { d.to_f * Math::PI / 180 }
      dlat = rad.call(lat2 - lat1)
      dlng = rad.call(lng2 - lng1)
      a = (Math.sin(dlat / 2)**2) +
          (Math.cos(rad.call(lat1)) * Math.cos(rad.call(lat2)) * (Math.sin(dlng / 2)**2))
      (2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a))).round
    end
  end
end
