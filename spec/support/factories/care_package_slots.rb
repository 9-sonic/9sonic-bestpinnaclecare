FactoryBot.define do
  factory :care_package_slot do
    service_user
    name { "Morning call" }
    start_time { "08:00" }
    end_time { "08:45" }
    recurrence { "daily" }
    staff_required { 1 }
    break_minutes { 0 }
    effective_from { Date.current }
  end
end
