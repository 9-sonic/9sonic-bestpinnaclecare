FactoryBot.define do
  factory :employee do
    sequence(:email) { |n| "carer#{n}@bpc.test" }
    password { "secret12" }
    first_name { "Cara" }
    last_name  { "Er" }
    role { :carer }
  end
end
