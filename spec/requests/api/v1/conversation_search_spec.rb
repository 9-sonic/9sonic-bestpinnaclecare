require "rails_helper"

RSpec.describe "Conversation search (message bodies)", type: :request do
  let(:admin)      { create(:admin) }
  let(:alice)      { create(:employee) }
  let(:admin_auth) { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:emp_auth)   { { "Authorization" => "Bearer #{jwt_for(alice, :employee)}" } }

  def dm_with(other, headers: admin_auth)
    post "/api/v1/conversations", params: { kind: "direct", participant: { type: other.class.name, id: other.id } },
         headers: headers, as: :json
    response.parsed_body["id"]
  end

  def say(convo_id, body, headers: admin_auth)
    post "/api/v1/conversations/#{convo_id}/messages",
         params: { body: body, client_message_id: SecureRandom.uuid }, headers: headers, as: :json
  end

  it "finds a conversation by the text of a message in it" do
    convo_id = dm_with(alice)
    say(convo_id, "hi there, running late for the Oakwood visit")

    get "/api/v1/conversations/search", params: { q: "Oakwood" }, headers: admin_auth
    expect(response).to have_http_status(:ok)
    results = response.parsed_body["results"]
    expect(results.map { |r| r["conversation_id"] }).to include(convo_id)
    expect(results.first["snippet"]).to include("Oakwood")
  end

  it "is case-insensitive" do
    convo_id = dm_with(alice)
    say(convo_id, "Please Call The Office")

    get "/api/v1/conversations/search", params: { q: "call the office" }, headers: admin_auth
    expect(response.parsed_body["results"].map { |r| r["conversation_id"] }).to include(convo_id)
  end

  it "matches short queries like the last-message text" do
    convo_id = dm_with(alice)
    say(convo_id, "hi")

    get "/api/v1/conversations/search", params: { q: "hi" }, headers: admin_auth
    expect(response.parsed_body["results"].map { |r| r["conversation_id"] }).to include(convo_id)
  end

  it "never returns a message from a conversation the caller isn't in" do
    # A DM between alice and someone else — admin is not a participant.
    bob = create(:employee)
    convo_id = dm_with(bob, headers: emp_auth) # created by alice with bob
    say(convo_id, "secret handover code 4471", headers: emp_auth)

    get "/api/v1/conversations/search", params: { q: "4471" }, headers: admin_auth
    expect(response.parsed_body["results"]).to be_empty
  end

  it "returns an empty result for a blank query" do
    convo_id = dm_with(alice)
    say(convo_id, "anything")

    get "/api/v1/conversations/search", params: { q: "  " }, headers: admin_auth
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["results"]).to eq([])
  end

  it "escapes LIKE wildcards so % doesn't match everything" do
    convo_id = dm_with(alice)
    say(convo_id, "plain message")

    get "/api/v1/conversations/search", params: { q: "%" }, headers: admin_auth
    expect(response.parsed_body["results"]).to be_empty
  end
end
