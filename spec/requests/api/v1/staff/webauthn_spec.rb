require "rails_helper"

RSpec.describe "WebAuthn passkeys (staff)", type: :request, webauthn: true do
  let!(:employee) { create(:employee, email: "carer@bpc.test", password: "secret12") }
  let(:client) { WebAuthn::FakeClient.new("http://localhost") } # simulated phone authenticator

  def staff_token
    post "/api/v1/staff/auth/login", params: { email: "carer@bpc.test", password: "secret12" }, as: :json
    response.parsed_body["access"]
  end

  it "registers a passkey and then logs in passwordlessly" do
    token = staff_token
    auth = { "Authorization" => "Bearer #{token}" }

    # registration options + create
    post "/api/v1/staff/webauthn/registration/options", headers: auth
    expect(response).to have_http_status(:ok)
    reg = response.parsed_body
    attestation = client.create(challenge: reg.dig("options", "challenge"))

    post "/api/v1/staff/webauthn/registration",
         params: { challenge_token: reg["challenge_token"], credential: attestation, nickname: "iPhone" },
         headers: auth, as: :json
    expect(response).to have_http_status(:created)
    expect(employee.webauthn_credentials.count).to eq(1)

    # passwordless (biometric) login
    post "/api/v1/staff/webauthn/authentication/options", params: { email: "carer@bpc.test" }, as: :json
    expect(response).to have_http_status(:ok)
    aut = response.parsed_body
    assertion = client.get(challenge: aut.dig("options", "challenge"))

    post "/api/v1/staff/webauthn/authentication",
         params: { challenge_token: aut["challenge_token"], credential: assertion }, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["access"]).to be_present
    expect(response.parsed_body.dig("employee", "email")).to eq("carer@bpc.test")
  end

  it "returns no_passkey for an unknown email" do
    post "/api/v1/staff/webauthn/authentication/options", params: { email: "ghost@bpc.test" }, as: :json
    expect(response).to have_http_status(:not_found)
  end

  it "rejects a garbage/expired challenge token on registration" do
    token = staff_token
    auth = { "Authorization" => "Bearer #{token}" }
    post "/api/v1/staff/webauthn/registration/options", headers: auth
    attestation = client.create(challenge: response.parsed_body.dig("options", "challenge"))

    post "/api/v1/staff/webauthn/registration",
         params: { challenge_token: "garbage", credential: attestation }, headers: auth, as: :json
    expect(response).to have_http_status(:unauthorized)
  end
end
