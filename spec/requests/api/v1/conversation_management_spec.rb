require "rails_helper"

RSpec.describe "Managing channels and groups", type: :request do
  let(:admin)      { create(:admin) }
  let(:carer_a)    { create(:employee) }
  let(:carer_b)    { create(:employee) }
  let(:admin_auth) { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:a_auth)     { { "Authorization" => "Bearer #{jwt_for(carer_a, :employee)}" } }

  # Create a group owned by the admin with carer_a and carer_b in it; return id.
  def make_group
    post "/api/v1/conversations",
         params: { kind: "group", title: "Morning shift",
                   participants: [ { type: "Employee", id: carer_a.id }, { type: "Employee", id: carer_b.id } ] },
         headers: admin_auth, as: :json
    response.parsed_body["id"]
  end

  def make_direct
    post "/api/v1/conversations", params: { kind: "direct", participant: { type: "Employee", id: carer_a.id } },
         headers: admin_auth, as: :json
    response.parsed_body["id"]
  end

  describe "renaming / purpose" do
    it "renames a group and posts a system message announcing it" do
      id = make_group

      expect {
        patch "/api/v1/conversations/#{id}", params: { title: "Evening shift" }, headers: admin_auth, as: :json
      }.to change { Conversation.find(id).messages.where(system: true).count }.by(1)

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["title"]).to eq("Evening shift")
    end

    it "edits the purpose without announcing (no rename happened)" do
      id = make_group
      expect {
        patch "/api/v1/conversations/#{id}", params: { purpose: "Cover + handover notes" }, headers: admin_auth, as: :json
      }.not_to change { Conversation.find(id).messages.where(system: true).count }
      expect(response.parsed_body["purpose"]).to eq("Cover + handover notes")
    end

    it "rejects a blank title" do
      id = make_group
      patch "/api/v1/conversations/#{id}", params: { title: "  " }, headers: admin_auth, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "won't rename a direct thread" do
      id = make_direct
      patch "/api/v1/conversations/#{id}", params: { title: "Nope" }, headers: admin_auth, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["error"]).to eq("cannot_rename_direct")
    end

    it "won't let a non-member rename it (404)" do
      id = make_group
      outsider = create(:employee)
      patch "/api/v1/conversations/#{id}", params: { title: "Hijack" },
            headers: { "Authorization" => "Bearer #{jwt_for(outsider, :employee)}" }, as: :json
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "removing members" do
    it "removes a member (soft) and drops them from the roster" do
      id = make_group

      delete "/api/v1/conversations/#{id}/participants/Employee/#{carer_b.id}", headers: admin_auth, as: :json
      expect(response).to have_http_status(:ok)

      ids = response.parsed_body["participants"].map { |p| [ p["type"], p["id"] ] }
      expect(ids).not_to include([ "Employee", carer_b.id ])
      # Row kept, just marked left_at — history preserved.
      cp = Conversation.find(id).conversation_participants.find_by(participant: carer_b)
      expect(cp.left_at).to be_present
    end

    it "won't remove from a direct thread" do
      id = make_direct
      delete "/api/v1/conversations/#{id}/participants/Employee/#{carer_a.id}", headers: admin_auth, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
    end

    it "a removed member can no longer see the thread" do
      id = make_group
      delete "/api/v1/conversations/#{id}/participants/Employee/#{carer_a.id}", headers: admin_auth, as: :json

      get "/api/v1/conversations", headers: a_auth
      expect(response.parsed_body.map { |c| c["id"] }).not_to include(id)
    end
  end

  describe "deleting a channel/group" do
    it "soft-archives it and drops it from everyone's list" do
      id = make_group

      expect {
        delete "/api/v1/conversations/#{id}", headers: admin_auth, as: :json
      }.not_to change(Conversation, :count) # kept, archived
      expect(response).to have_http_status(:no_content)
      expect(Conversation.find(id).archived_at).to be_present

      get "/api/v1/conversations", headers: admin_auth
      expect(response.parsed_body.map { |c| c["id"] }).not_to include(id)

      get "/api/v1/conversations", headers: a_auth
      expect(response.parsed_body.map { |c| c["id"] }).not_to include(id)
    end

    it "won't delete a direct thread" do
      id = make_direct
      delete "/api/v1/conversations/#{id}", headers: admin_auth, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["error"]).to eq("cannot_delete_direct")
    end
  end
end
