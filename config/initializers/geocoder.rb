Geocoder.configure(
  lookup:       Rails.env.test? ? :test : :nominatim,
  use_https:    true,
  timeout:      5,
  units:        :km,
  # Nominatim's usage policy requires a descriptive User-Agent.
  http_headers: { "User-Agent" => "BestPinnacleCare/1.0 (care-scheduling)" }
)

if Rails.env.test?
  # Any address resolves to a fixed Manchester coordinate in the test suite.
  Geocoder::Lookup::Test.set_default_stub(
    [ { "coordinates" => [ 53.4808, -2.2426 ], "address" => "Manchester, UK",
        "city" => "Manchester", "country" => "United Kingdom" } ]
  )
end
