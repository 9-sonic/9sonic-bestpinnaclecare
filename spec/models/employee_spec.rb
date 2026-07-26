require "rails_helper"

RSpec.describe Employee, type: :model do
  it "has a valid factory defaulting to the carer role" do
    employee = create(:employee)
    expect(employee).to be_valid
    expect(employee.role).to eq("carer")
  end

  it "authenticates with Devise and needs no MFA by default" do
    employee = create(:employee, password: "secret12")
    expect(employee.valid_password?("secret12")).to be(true)
    expect(employee.mfa_setup_required?).to be(false)
  end

  it "owns webauthn credentials polymorphically" do
    employee = create(:employee)
    cred = employee.webauthn_credentials.create!(external_id: "abc123", public_key: "pk", sign_count: 0)
    expect(cred.owner).to eq(employee)
    expect(cred.owner_type).to eq("Employee")
  end
end
