require "rails_helper"

RSpec.describe "MFA (TOTP)", type: :request do
  let!(:admin) { create(:admin, email: "boss@bpc.test", password: "secret12", mfa_enabled: false) }

  def login
    post "/api/v1/admin/auth/login", params: { email: "boss@bpc.test", password: "secret12" }, as: :json
    response.parsed_body["access"]
  end

  it "enrols, confirms, then enforces a code on the next login" do
    token = login
    expect(response.parsed_body["access"]).to be_present # no MFA yet

    # enrol
    post "/api/v1/admin/mfa", headers: { "Authorization" => "Bearer #{token}" }
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["qr_svg"]).to include("<svg")
    secret = response.parsed_body["otpauth_uri"][/secret=([A-Z2-7]+)/, 1]
    expect(secret).to be_present

    # wrong confirmation code
    post "/api/v1/admin/mfa/confirm", params: { otp_code: "000000" },
         headers: { "Authorization" => "Bearer #{token}" }, as: :json
    expect(response).to have_http_status(422)

    # correct confirmation code -> backup codes
    post "/api/v1/admin/mfa/confirm", params: { otp_code: ROTP::TOTP.new(secret).now },
         headers: { "Authorization" => "Bearer #{token}" }, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["backup_codes"].size).to eq(10)

    # login now requires MFA (no access token yet)
    post "/api/v1/admin/auth/login", params: { email: "boss@bpc.test", password: "secret12" }, as: :json
    expect(response.parsed_body["mfa_required"]).to be(true)
    expect(response.parsed_body["access"]).to be_nil
    mfa_token = response.parsed_body["mfa_token"]

    # wrong TOTP -> 401
    post "/api/v1/auth/mfa", params: { mfa_token: mfa_token, otp_code: "000000" }, as: :json
    expect(response).to have_http_status(:unauthorized)

    # correct TOTP -> access token
    post "/api/v1/auth/mfa", params: { mfa_token: mfa_token, otp_code: ROTP::TOTP.new(secret).now }, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["access"]).to be_present
  end

  it "accepts a backup code once and rejects its reuse" do
    admin = create(:admin, :with_mfa, email: "mgr@bpc.test", password: "secret12")
    codes = Mfa::BackupCodes.generate
    admin.update!(mfa_backup_codes: codes.map { |c| Mfa::BackupCodes.digest(c) })

    post "/api/v1/admin/auth/login", params: { email: "mgr@bpc.test", password: "secret12" }, as: :json
    post "/api/v1/auth/mfa", params: { mfa_token: response.parsed_body["mfa_token"], otp_code: codes.first }, as: :json
    expect(response).to have_http_status(:ok)

    post "/api/v1/admin/auth/login", params: { email: "mgr@bpc.test", password: "secret12" }, as: :json
    post "/api/v1/auth/mfa", params: { mfa_token: response.parsed_body["mfa_token"], otp_code: codes.first }, as: :json
    expect(response).to have_http_status(:unauthorized)
  end
end
