require "rails_helper"

RSpec.describe "Editing and deleting messages", type: :request do
  let(:admin)      { create(:admin) }
  let(:employee)   { create(:employee) }
  let(:admin_auth) { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:emp_auth)   { { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" } }

  # Open a direct thread between the admin and the employee and return its id.
  def open_direct
    post "/api/v1/conversations", params: { kind: "direct", participant: { type: "Employee", id: employee.id } },
         headers: admin_auth, as: :json
    response.parsed_body["id"]
  end

  # Send a message as the admin; return its id.
  def send_as_admin(convo_id, body: "Hello")
    post "/api/v1/conversations/#{convo_id}/messages",
         params: { body: body, client_message_id: SecureRandom.uuid }, headers: admin_auth, as: :json
    response.parsed_body["id"]
  end

  describe "editing" do
    it "lets the sender edit their own message and stamps edited_at" do
      convo_id = open_direct
      msg_id = send_as_admin(convo_id, body: "Frist draft")

      patch "/api/v1/conversations/#{convo_id}/messages/#{msg_id}",
            params: { body: "First draft" }, headers: admin_auth, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["body"]).to eq("First draft")
      expect(response.parsed_body["edited_at"]).to be_present
    end

    it "won't let someone edit a message they didn't send (403)" do
      convo_id = open_direct
      msg_id = send_as_admin(convo_id, body: "Mine")

      patch "/api/v1/conversations/#{convo_id}/messages/#{msg_id}",
            params: { body: "Hijacked" }, headers: emp_auth, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(Message.find(msg_id).body).to eq("Mine")
    end
  end

  describe "deleting" do
    it "soft-deletes: the row stays, the body is gone, and it reads as a tombstone" do
      convo_id = open_direct
      msg_id = send_as_admin(convo_id, body: "Please ignore")

      expect {
        delete "/api/v1/conversations/#{convo_id}/messages/#{msg_id}", headers: admin_auth, as: :json
      }.not_to change(Message, :count) # the record is kept, not destroyed

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["deleted_at"]).to be_present
      expect(response.parsed_body["body"]).to be_nil
      expect(Message.find(msg_id).deleted_at).to be_present
    end

    it "keeps the tombstone in the thread on reload, with no body leaked" do
      convo_id = open_direct
      msg_id = send_as_admin(convo_id, body: "secret")
      delete "/api/v1/conversations/#{convo_id}/messages/#{msg_id}", headers: admin_auth, as: :json

      get "/api/v1/conversations/#{convo_id}/messages", headers: emp_auth
      row = response.parsed_body.find { |m| m["id"] == msg_id }
      expect(row).to be_present            # still in the thread
      expect(row["deleted_at"]).to be_present
      expect(row["body"]).to be_nil        # old text never leaves the server
    end

    it "won't let someone delete a message they didn't send (403)" do
      convo_id = open_direct
      msg_id = send_as_admin(convo_id, body: "Mine")

      delete "/api/v1/conversations/#{convo_id}/messages/#{msg_id}", headers: emp_auth, as: :json

      expect(response).to have_http_status(:forbidden)
      expect(Message.find(msg_id).deleted_at).to be_nil
    end

    it "drops a deleted message out of the conversation's pinned banner" do
      convo_id = open_direct
      msg_id = send_as_admin(convo_id, body: "pin me")
      post "/api/v1/conversations/#{convo_id}/messages/#{msg_id}/pin", headers: admin_auth, as: :json

      delete "/api/v1/conversations/#{convo_id}/messages/#{msg_id}", headers: admin_auth, as: :json

      get "/api/v1/conversations", headers: admin_auth
      convo = response.parsed_body.find { |c| c["id"] == convo_id }
      expect(convo["pinned_message"]).to be_nil
    end
  end
end
