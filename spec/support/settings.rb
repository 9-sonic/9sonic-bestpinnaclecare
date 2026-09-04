RSpec.configure do |config|
  # The clocking services read the single-row Setting (geofence mode/radius, skew).
  config.before do
    Setting.first_or_create!(id: 1, company_name: "Best Pinnacle Care Ltd")
  end
end

# Carer double-booking is a provider policy and ships ON (a carer may hold any
# number of overlapping visits). Specs that exercise the BLOCK have to ask for
# it explicitly, so the default stays honest in the tests too.
module DoubleBookingPolicy
  def block_carer_double_booking!
    Setting.instance.update!(policy: { "allow_carer_double_booking" => false })
  end
end

RSpec.configure { |c| c.include DoubleBookingPolicy, type: :request }
