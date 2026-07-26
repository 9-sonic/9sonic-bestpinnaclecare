require "rails_helper"

RSpec.describe Admin, type: :model do
  it "has a valid factory" do
    expect(build(:admin)).to be_valid
  end

  it "authenticates with Devise database_authenticatable" do
    admin = create(:admin, password: "secret12")
    expect(admin.valid_password?("secret12")).to be(true)
    expect(admin.valid_password?("wrong")).to be(false)
    expect(admin.encrypted_password).to start_with("$2") # bcrypt
  end

  it "enforces case-insensitive email uniqueness (citext)" do
    create(:admin, email: "boss@bpc.test")
    expect(build(:admin, email: "BOSS@BPC.TEST")).not_to be_valid
  end

  it "stores role as its native enum label" do
    expect(create(:admin, role: :coordinator).role).to eq("coordinator")
  end

  describe "#active_for_authentication?" do
    it "is true for an active account" do
      expect(create(:admin, active: true).active_for_authentication?).to be(true)
    end

    it "is false for a deactivated account" do
      expect(create(:admin, active: false).active_for_authentication?).to be(false)
    end
  end

  describe "MFA helpers" do
    it "is not active and needs setup while enabled-but-unconfirmed" do
      admin = create(:admin, mfa_enabled: true, mfa_secret: ROTP::Base32.random)
      expect(admin.mfa_active?).to be(false)
      expect(admin.mfa_setup_required?).to be(true)
    end

    it "is active once confirmed" do
      admin = create(:admin, :with_mfa)
      expect(admin.mfa_active?).to be(true)
      expect(admin.mfa_setup_required?).to be(false)
    end
  end

  it "generates a stable webauthn handle on demand" do
    admin = create(:admin)
    handle = admin.webauthn_handle
    expect(handle).to be_present
    expect(admin.reload.webauthn_handle).to eq(handle)
  end
end
