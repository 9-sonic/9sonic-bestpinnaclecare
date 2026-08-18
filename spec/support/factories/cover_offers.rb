FactoryBot.define do
  factory :cover_offer do
    visit
    employee
    state { "pending" }
    offered_at { Time.current }
  end
end
