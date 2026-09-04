RSpec.configure do |config|
  # The clocking services read the single-row Setting (geofence mode/radius, skew).
  config.before do
    Setting.first_or_create!(id: 1, company_name: "Best Pinnacle Care Ltd")
  end
end
