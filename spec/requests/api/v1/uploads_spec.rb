require "rails_helper"

RSpec.describe "File uploads — avatars + message attachments", type: :request do
  def upload(content_type = "image/png")
    Rack::Test::UploadedFile.new(Rails.root.join("spec/fixtures/files/avatar.png"), content_type)
  end

  describe "avatars" do
    it "a carer uploads then removes their own avatar" do
      emp  = create(:employee)
      auth = { "Authorization" => "Bearer #{jwt_for(emp, :employee)}" }

      post "/api/v1/staff/me/avatar", params: { avatar: upload }, headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["avatar_url"]).to be_present
      expect(emp.reload.avatar).to be_attached

      delete "/api/v1/staff/me/avatar", headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["avatar_url"]).to be_nil
    end

    it "an admin uploads their own avatar" do
      admin = create(:admin)
      auth  = { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" }
      post "/api/v1/admin/me/avatar", params: { avatar: upload }, headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["avatar_url"]).to be_present
      expect(admin.reload.avatar).to be_attached
    end

    it "the office sets a carer's avatar" do
      admin = create(:admin) # manager role passes the gate
      emp   = create(:employee)
      auth  = { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" }
      post "/api/v1/admin/employees/#{emp.id}/avatar", params: { avatar: upload }, headers: auth
      expect(response).to have_http_status(:ok)
      expect(emp.reload.avatar).to be_attached
    end

    it "rejects a non-image file (422 unsupported_type)" do
      emp  = create(:employee)
      auth = { "Authorization" => "Bearer #{jwt_for(emp, :employee)}" }
      post "/api/v1/staff/me/avatar", params: { avatar: upload("application/pdf") }, headers: auth
      expect(response).to have_http_status(422)
      expect(response.parsed_body["error"]).to eq("unsupported_type")
      expect(emp.reload.avatar).not_to be_attached
    end
  end

  describe "message attachments" do
    it "sends a message with a file attachment and serialises it" do
      admin = create(:admin)
      carer = create(:employee)
      convo = Messaging::CreateConversation.direct(creator: admin, other: carer)
      auth  = { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" }

      post "/api/v1/conversations/#{convo.id}/messages",
           params: { body: "here is the form", client_message_id: SecureRandom.uuid, files: [ upload ] }, headers: auth
      expect(response).to have_http_status(:created)
      atts = response.parsed_body["attachments"]
      expect(atts.size).to eq(1)
      expect(atts.first["filename"]).to eq("avatar.png")
      expect(atts.first["content_type"]).to eq("image/png")
      expect(atts.first["url"]).to be_present
    end
  end
end
