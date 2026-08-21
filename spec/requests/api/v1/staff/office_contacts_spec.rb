require "rails_helper"

RSpec.describe "Carer office directory + who a carer can message", type: :request do
  let(:carer)      { create(:employee) }
  let(:carer_auth) { { "Authorization" => "Bearer #{jwt_for(carer, :employee)}" } }

  describe "GET /api/v1/staff/office_contacts" do
    it "lists active admins the carer can start a chat with" do
      manager = create(:admin, first_name: "Rebecca", last_name: "Hartley", role: "registered_manager")
      create(:admin, first_name: "Zoe", last_name: "Gone", active: false) # deactivated — must be hidden

      get "/api/v1/staff/office_contacts", headers: carer_auth
      expect(response).to have_http_status(:ok)

      names = response.parsed_body.map { |a| a["full_name"] }
      expect(names).to include("Rebecca Hartley")
      expect(names).not_to include("Zoe Gone")

      rebecca = response.parsed_body.find { |a| a["full_name"] == "Rebecca Hartley" }
      expect(rebecca["type"]).to eq("Admin")
      expect(rebecca["id"]).to eq(manager.id)
      expect(rebecca["role_label"]).to eq("Registered manager")
    end

    it "does not list other carers or clients" do
      create(:employee, first_name: "Other", last_name: "Carer")
      get "/api/v1/staff/office_contacts", headers: carer_auth
      expect(response.parsed_body.map { |a| a["type"] }.uniq).to eq([ "Admin" ]).or eq([])
    end

    it "requires a carer session" do
      get "/api/v1/staff/office_contacts"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "who a carer may create a conversation with" do
    it "lets a carer open a direct with an office admin" do
      admin = create(:admin)
      post "/api/v1/conversations",
           params: { kind: "direct", participant: { type: "Admin", id: admin.id } },
           headers: carer_auth, as: :json
      expect(response).to have_http_status(:created)
      types = response.parsed_body["participants"].map { |p| p["type"] }.sort
      expect(types).to eq(%w[Admin Employee])
    end

    it "refuses a carer trying to DM another carer" do
      other = create(:employee)
      post "/api/v1/conversations",
           params: { kind: "direct", participant: { type: "Employee", id: other.id } },
           headers: carer_auth, as: :json
      expect(response).to have_http_status(:forbidden)
      expect(response.parsed_body["error"]).to eq("carers_can_only_message_the_office")
    end

    it "refuses a carer trying to create a group" do
      admin = create(:admin)
      post "/api/v1/conversations",
           params: { kind: "group", title: "Sneaky", participants: [ { type: "Admin", id: admin.id } ] },
           headers: carer_auth, as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end
end
