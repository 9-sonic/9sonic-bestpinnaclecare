require "rails_helper"

RSpec.describe "Messaging extras — purpose, auto-post, pin, mute, chase, shift attach", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:carer) { create(:employee) }

  it "creates a channel with a purpose + auto_post, and mutes it" do
    post "/api/v1/conversations",
         params: { kind: "channel", title: "#ops", purpose: "Daily operations", auto_post: true,
                   participants: [ { type: "Employee", id: carer.id } ] }, headers: auth, as: :json
    expect(response).to have_http_status(:created)
    expect(response.parsed_body["purpose"]).to eq("Daily operations")
    expect(response.parsed_body["auto_post"]).to be(true)
    id = response.parsed_body["id"]

    patch "/api/v1/conversations/#{id}/mute", params: { muted: true }, headers: auth, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["muted"]).to be(true)
  end

  it "pins and unpins a message; the pin surfaces on the conversation" do
    convo = Messaging::CreateConversation.direct(creator: admin, other: carer)
    msg = Messaging::SendMessage.call(conversation: convo, sender: admin, body: "important", client_message_id: SecureRandom.uuid)

    post "/api/v1/conversations/#{convo.id}/messages/#{msg.id}/pin", headers: auth
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["pinned_at"]).to be_present

    get "/api/v1/conversations", headers: auth
    convo_json = response.parsed_body.find { |c| c["id"] == convo.id }
    expect(convo_json.dig("pinned_message", "id")).to eq(msg.id)

    delete "/api/v1/conversations/#{convo.id}/messages/#{msg.id}/pin", headers: auth
    expect(response.parsed_body["pinned_at"]).to be_nil
  end

  it "attaches a visit (shift) to a message" do
    convo = Messaging::CreateConversation.direct(creator: admin, other: carer)
    visit = create(:visit, service_user: create(:service_user))
    post "/api/v1/conversations/#{convo.id}/messages",
         params: { body: "about this visit", client_message_id: SecureRandom.uuid, visit_id: visit.id }, headers: auth, as: :json
    expect(response).to have_http_status(:created)
    expect(response.parsed_body.dig("visit", "id")).to eq(visit.id)
    expect(response.parsed_body.dig("visit", "client")).to be_present
  end

  it "chases the participants who haven't read the latest message" do
    convo = Messaging::CreateConversation.channel(creator: admin, title: "#team", participants: [ carer ])
    Messaging::SendMessage.call(conversation: convo, sender: admin, body: "read me", client_message_id: SecureRandom.uuid)
    post "/api/v1/conversations/#{convo.id}/chase", headers: auth
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["chased"]).to be >= 1
  end

  it "auto-posts a raised alert into auto_post channels as a system message (no sender)" do
    channel = Messaging::CreateConversation.channel(creator: admin, title: "#alerts", participants: [ carer ], auto_post: true)
    va = create(:visit_assignment, employee: carer, visit: create(:visit, service_user: create(:service_user)))

    expect do
      Alerts::Raise.call(subject: va, alert_type: "missed_visit", severity: "high")
    end.to change { channel.messages.where(system: true).count }.by(1)

    msg = channel.messages.where(system: true).order(:created_at).last
    expect(msg.sender_id).to be_nil
    expect(msg.body).to include("Missed visit")
  end

  it "does not auto-post into ordinary channels" do
    plain = Messaging::CreateConversation.channel(creator: admin, title: "#chat", participants: [ carer ])
    va = create(:visit_assignment, employee: carer, visit: create(:visit, service_user: create(:service_user)))
    expect do
      Alerts::Raise.call(subject: va, alert_type: "no_clock_out")
    end.not_to(change { plain.messages.count })
  end
end
