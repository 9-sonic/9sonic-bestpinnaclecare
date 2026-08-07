require "rails_helper"

RSpec.describe "Settings policy + messaging channels", type: :request do
  let(:admin)     { create(:admin, role: :registered_manager) }
  let(:admin_hdr) { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:employee)  { create(:employee) }

  describe "settings policy" do
    it "saves and returns the policy blob" do
      patch "/api/v1/admin/settings", params: { policy: { gpsOptional: true, smsFallback: false } }, headers: admin_hdr, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["policy"]).to eq("gpsOptional" => true, "smsFallback" => false)

      get "/api/v1/admin/settings", headers: admin_hdr
      expect(response.parsed_body["policy"]["gpsOptional"]).to be(true)
    end
  end

  describe "channels + broadcast" do
    it "creates a channel and broadcasts with an ack tally" do
      post "/api/v1/conversations",
           params: { kind: "channel", title: "#north-team", participants: [ { type: "Employee", id: employee.id } ] },
           headers: admin_hdr, as: :json
      expect(response).to have_http_status(:created)
      expect(response.parsed_body["kind"]).to eq("channel")
      channel_id = response.parsed_body["id"]

      post "/api/v1/conversations/#{channel_id}/messages",
           params: { body: "Team catch-up Friday 9am", client_message_id: SecureRandom.uuid, broadcast: true },
           headers: admin_hdr, as: :json
      expect(response).to have_http_status(:created)
      body = response.parsed_body
      expect(body["broadcast"]).to be(true)
      expect(body["recipient_count"]).to eq(1)  # the one employee member
      expect(body["read_count"]).to eq(0)
    end
  end
end
