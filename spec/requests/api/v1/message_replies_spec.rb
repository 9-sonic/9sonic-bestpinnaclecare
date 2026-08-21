require "rails_helper"

RSpec.describe "Replying to messages", type: :request do
  let(:admin)      { create(:admin) }
  let(:employee)   { create(:employee) }
  let(:admin_auth) { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:emp_auth)   { { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" } }

  def open_direct
    post "/api/v1/conversations", params: { kind: "direct", participant: { type: "Employee", id: employee.id } },
         headers: admin_auth, as: :json
    response.parsed_body["id"]
  end

  def send_as(convo_id, auth, body: "Original")
    post "/api/v1/conversations/#{convo_id}/messages",
         params: { body: body, client_message_id: SecureRandom.uuid }, headers: auth, as: :json
    response.parsed_body["id"]
  end

  it "stores a reply and serializes a reference back to the original" do
    convo_id = open_direct
    original_id = send_as(convo_id, emp_auth, body: "Can you cover Friday?")

    post "/api/v1/conversations/#{convo_id}/messages",
         params: { body: "Yes, I've got it", client_message_id: SecureRandom.uuid, reply_to_id: original_id },
         headers: admin_auth, as: :json

    expect(response).to have_http_status(:created)
    ref = response.parsed_body["reply_to"]
    expect(ref).to be_present
    expect(ref["id"]).to eq(original_id)
    expect(ref["snippet"]).to eq("Can you cover Friday?")
    expect(ref["deleted"]).to be(false)
  end

  it "shows the reply reference on reload (index eager-loads it)" do
    convo_id = open_direct
    original_id = send_as(convo_id, admin_auth, body: "Ping")
    post "/api/v1/conversations/#{convo_id}/messages",
         params: { body: "Pong", client_message_id: SecureRandom.uuid, reply_to_id: original_id },
         headers: emp_auth, as: :json

    get "/api/v1/conversations/#{convo_id}/messages", headers: admin_auth
    reply = response.parsed_body.find { |m| m["body"] == "Pong" }
    expect(reply["reply_to"]["id"]).to eq(original_id)
  end

  it "ignores a reply_to_id from a different conversation (drops the link, still sends)" do
    convo_a = open_direct
    other_carer = create(:employee)
    post "/api/v1/conversations", params: { kind: "direct", participant: { type: "Employee", id: other_carer.id } },
         headers: admin_auth, as: :json
    convo_b = response.parsed_body["id"]
    foreign_id = send_as(convo_b, admin_auth, body: "In another thread")

    post "/api/v1/conversations/#{convo_a}/messages",
         params: { body: "Nice try", client_message_id: SecureRandom.uuid, reply_to_id: foreign_id },
         headers: admin_auth, as: :json

    expect(response).to have_http_status(:created)
    expect(response.parsed_body["reply_to"]).to be_nil # cross-conversation link refused
  end

  it "keeps the reply but tombstones the reference when the original is deleted" do
    convo_id = open_direct
    original_id = send_as(convo_id, admin_auth, body: "delete me")
    post "/api/v1/conversations/#{convo_id}/messages",
         params: { body: "replying", client_message_id: SecureRandom.uuid, reply_to_id: original_id },
         headers: admin_auth, as: :json
    reply_id = response.parsed_body["id"]

    delete "/api/v1/conversations/#{convo_id}/messages/#{original_id}", headers: admin_auth, as: :json

    get "/api/v1/conversations/#{convo_id}/messages", headers: admin_auth
    reply = response.parsed_body.find { |m| m["id"] == reply_id }
    expect(reply["reply_to"]["id"]).to eq(original_id)
    expect(reply["reply_to"]["deleted"]).to be(true)
    expect(reply["reply_to"]["snippet"]).to be_nil # deleted original leaks no body
  end
end
