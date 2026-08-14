require "rails_helper"

RSpec.describe "Conversation participants (add to group/channel)", type: :request do
  let(:admin)      { create(:admin) }
  let(:alice)      { create(:employee) }
  let(:bob)        { create(:employee) }
  let(:admin_auth) { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:emp_auth)   { { "Authorization" => "Bearer #{jwt_for(alice, :employee)}" } }

  def create_group(participants: [])
    post "/api/v1/conversations",
         params: { kind: "group", title: "Care team", participants: participants },
         headers: admin_auth, as: :json
    response.parsed_body["id"]
  end

  def add(convo_id, people, headers: admin_auth)
    post "/api/v1/conversations/#{convo_id}/participants",
         params: { participants: people }, headers: headers, as: :json
  end

  it "adds a new participant to an existing group" do
    convo_id = create_group(participants: [ { type: "Employee", id: alice.id } ])

    add(convo_id, [ { type: "Employee", id: bob.id } ])
    expect(response).to have_http_status(:ok)

    ids = response.parsed_body["participants"].map { |p| [ p["type"], p["id"] ] }
    expect(ids).to include([ "Employee", bob.id ])
    # creator (admin) + alice + bob
    expect(response.parsed_body["participants"].size).to eq(3)
  end

  it "posts a system message naming who was added" do
    convo_id = create_group(participants: [ { type: "Employee", id: alice.id } ])

    expect {
      add(convo_id, [ { type: "Employee", id: bob.id } ])
    }.to change(Message.where(system: true), :count).by(1)

    get "/api/v1/conversations/#{convo_id}/messages", headers: admin_auth
    expect(response.parsed_body.map { |m| m["body"] }.join).to include("added").and include(bob.full_name)
  end

  it "is idempotent — re-adding a current member is a no-op" do
    convo_id = create_group(participants: [ { type: "Employee", id: alice.id } ])
    add(convo_id, [ { type: "Employee", id: bob.id } ])

    expect {
      add(convo_id, [ { type: "Employee", id: bob.id } ])
    }.not_to change(ConversationParticipant, :count)
    expect(response).to have_http_status(:ok)
  end

  it "re-activates a member who previously left (clears left_at, no duplicate row)" do
    convo_id = create_group(participants: [ { type: "Employee", id: alice.id }, { type: "Employee", id: bob.id } ])
    cp = ConversationParticipant.find_by!(conversation_id: convo_id, participant: bob)
    cp.update!(left_at: 1.hour.ago)

    expect {
      add(convo_id, [ { type: "Employee", id: bob.id } ])
    }.not_to change(ConversationParticipant, :count)
    expect(cp.reload.left_at).to be_nil
  end

  it "refuses to add a third person to a direct thread" do
    post "/api/v1/conversations", params: { kind: "direct", participant: { type: "Employee", id: alice.id } },
         headers: admin_auth, as: :json
    dm_id = response.parsed_body["id"]

    add(dm_id, [ { type: "Employee", id: bob.id } ])
    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body["error"]).to eq("cannot_add_to_direct")
  end

  it "404s when the caller is not a member of the conversation" do
    convo_id = create_group(participants: [ { type: "Employee", id: alice.id } ])
    outsider = create(:employee)

    add(convo_id, [ { type: "Employee", id: bob.id } ],
        headers: { "Authorization" => "Bearer #{jwt_for(outsider, :employee)}" })
    expect(response).to have_http_status(:not_found)
  end

  it "lets an employee member add someone too (not admin-only)" do
    convo_id = create_group(participants: [ { type: "Employee", id: alice.id } ])

    add(convo_id, [ { type: "Employee", id: bob.id } ], headers: emp_auth)
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["participants"].map { |p| p["id"] }).to include(bob.id)
  end
end
