FactoryBot.define do
  factory :visit_assignment do
    visit
    employee
    assignment_status { "assigned" }
    lifecycle_state { "scheduled" }
  end
end
