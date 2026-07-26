FactoryBot.define do
  factory :visit do
    service_user
    scheduled_start { 1.hour.from_now }
    scheduled_end   { 2.hours.from_now }
    status { "draft" }
    staff_required { 1 }
  end
end
