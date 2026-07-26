require "rails_helper"

RSpec.describe "Messaging (staff chat)", type: :request do
  let(:admin)      { create(:admin) }
  let(:employee)   { create(:employee) }
  let(:admin_auth) { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:emp_auth)   { { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" } }

  def open_direct_as_admin
    post "/api/v1/conversations", params: { kind: "direct", participant: { type: "Employee", id: employee.id } },
         headers: admin_auth, as: :json
    response.parsed_body["id"]
  end

  it "an admin and an employee share one direct thread (polymorphic + dedupe)" do
    post "/api/v1/conversations", params: { kind: "direct", participant: { type: "Employee", id: employee.id } }, headers: admin_auth, as: :json
    expect(response).to have_http_status(:created)
    convo_id = response.parsed_body["id"]
    key = response.parsed_body["direct_key"]

    # employee opening a direct with the admin lands on the same thread
    post "/api/v1/conversations", params: { kind: "direct", participant: { type: "Admin", id: admin.id } }, headers: emp_auth, as: :json
    expect(response.parsed_body["id"]).to eq(convo_id)
    expect(response.parsed_body["direct_key"]).to eq(key)
  end

  it "sends messages idempotently and both sides can read them" do
    convo_id = open_direct_as_admin
    cid = SecureRandom.uuid

    post "/api/v1/conversations/#{convo_id}/messages", params: { body: "Hi", client_message_id: cid }, headers: admin_auth, as: :json
    expect(response).to have_http_status(:created)

    expect {
      post "/api/v1/conversations/#{convo_id}/messages", params: { body: "Hi", client_message_id: cid }, headers: admin_auth, as: :json
    }.not_to change(Message, :count)

    get "/api/v1/conversations/#{convo_id}/messages", headers: emp_auth
    expect(response.parsed_body.map { |m| m["body"] }).to include("Hi")
  end

  it "produces an in-app notification for the recipient" do
    employee # ensure recipient exists
    convo_id = open_direct_as_admin
    expect {
      post "/api/v1/conversations/#{convo_id}/messages", params: { body: "Yo", client_message_id: SecureRandom.uuid }, headers: admin_auth, as: :json
    }.to change { employee.notifications.where(channel: "in_app").count }.by(1)
  end

  it "tracks unread counts and clears them on read" do
    convo_id = open_direct_as_admin
    post "/api/v1/conversations/#{convo_id}/messages", params: { body: "1", client_message_id: SecureRandom.uuid }, headers: admin_auth, as: :json
    msg_id = response.parsed_body["id"]

    get "/api/v1/conversations", headers: emp_auth
    expect(response.parsed_body.find { |c| c["id"] == convo_id }["unread_count"]).to eq(1)

    post "/api/v1/messages/#{msg_id}/receipts", headers: emp_auth
    expect(response).to have_http_status(:ok)

    get "/api/v1/conversations", headers: emp_auth
    expect(response.parsed_body.find { |c| c["id"] == convo_id }["unread_count"]).to eq(0)
  end

  it "won't let a non-participant read a thread" do
    convo_id = open_direct_as_admin
    outsider = create(:employee)
    get "/api/v1/conversations/#{convo_id}/messages", headers: { "Authorization" => "Bearer #{jwt_for(outsider, :employee)}" }
    expect(response).to have_http_status(:not_found)
  end
end
