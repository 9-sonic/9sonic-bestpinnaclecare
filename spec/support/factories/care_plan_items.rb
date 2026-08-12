FactoryBot.define do
  factory :care_plan_item do
    service_user
    category { "medication" }
    sequence(:label) { |n| "Care plan item #{n}" }
    detail { nil }
    position { 0 }
    active { true }
  end
end
