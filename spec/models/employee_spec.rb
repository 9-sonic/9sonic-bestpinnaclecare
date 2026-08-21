require "rails_helper"

RSpec.describe Employee, type: :model do
  it "has a valid factory defaulting to the carer role" do
    employee = create(:employee)
    expect(employee).to be_valid
    expect(employee.role).to eq("carer")
  end

  it "auto-generates an EMP- reference when none is supplied" do
    employee = Employee.create!(first_name: "Tom", last_name: "W", email: "tom-#{SecureRandom.hex(4)}@x.test", password: "secret12")
    expect(employee.employee_reference).to match(/\AEMP-[0-9A-F]{8}\z/)
  end

  it "keeps a supplied reference" do
    employee = Employee.create!(first_name: "Al", last_name: "P", email: "al-#{SecureRandom.hex(4)}@x.test", password: "secret12", employee_reference: "MY-REF-1")
    expect(employee.employee_reference).to eq("MY-REF-1")
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
