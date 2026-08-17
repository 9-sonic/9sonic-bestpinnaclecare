require "rails_helper"

RSpec.describe "Admin devices (web push registration)", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }

  let(:subscription) do
    {
      endpoint: "https://push.example.com/abc",
      keys: { p256dh: "p256dh-key", auth: "auth-key" }
    }
  end

  it "registers this browser with its push subscription" do
    expect do
      post "/api/v1/admin/devices",
           params: { fingerprint: SecureRandom.uuid, platform: "web", push_subscription: subscription },
           headers: auth, as: :json
    end.to change { admin.devices.count }.by(1)

    expect(response).to have_http_status(:created)
    device = admin.devices.last
    expect(device.push_subscription["endpoint"]).to eq("https://push.example.com/abc")
    expect(device.push_subscription.dig("keys", "auth")).to eq("auth-key")
  end

  it "is idempotent on the fingerprint (updates, does not duplicate)" do
    fp = SecureRandom.uuid
    post "/api/v1/admin/devices", params: { fingerprint: fp, push_subscription: subscription }, headers: auth, as: :json
    expect(response).to have_http_status(:created)

    expect do
      post "/api/v1/admin/devices", params: { fingerprint: fp, push_subscription: subscription }, headers: auth, as: :json
    end.not_to change { admin.devices.count }
    expect(response).to have_http_status(:ok)
  end

  it "revokes a device on sign-out" do
    fp = SecureRandom.uuid
    post "/api/v1/admin/devices", params: { fingerprint: fp, push_subscription: subscription }, headers: auth, as: :json

    delete "/api/v1/admin/devices/#{fp}", headers: auth
    expect(response).to have_http_status(:no_content)
    expect(admin.devices.find_by(fingerprint: fp).revoked_at).to be_present
  end

  it "requires an admin token" do
    post "/api/v1/admin/devices", params: { fingerprint: SecureRandom.uuid }, as: :json
    expect(response).to have_http_status(:unauthorized)
  end
end

RSpec.describe "Admin push config", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }

  it "returns the VAPID public key and enabled flag" do
    get "/api/v1/admin/push/config", headers: auth
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body).to have_key("enabled")
    expect(body).to have_key("public_key")
  end
end
