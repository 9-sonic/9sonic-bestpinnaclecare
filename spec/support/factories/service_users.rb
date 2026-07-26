FactoryBot.define do
  factory :service_user do
    sequence(:first_name) { |n| "Client#{n}" }
    last_name { "Home" }
    lat { 53.4808 }   # a Manchester home
    lng { -2.2426 }
    geofence_radius_m { 150 }
    active { true }
  end
end
