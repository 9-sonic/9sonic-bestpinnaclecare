FactoryBot.define do
  factory :admin do
    sequence(:email) { |n| "admin#{n}@bpc.test" }
    password { "secret12" }
    first_name { "Reg" }
    last_name  { "Mgr" }
    role { :manager }
    mfa_enabled { false }   # base factory keeps login single-step; MFA specs opt in

    trait :with_mfa do
      mfa_enabled { true }
      mfa_secret { ROTP::Base32.random }
      mfa_confirmed_at { Time.current }
    end
  end
end
