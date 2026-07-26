require "rails_helper"

RSpec.describe "Auth login", type: :request do
  describe "POST /api/v1/admin/auth/login" do
    let!(:admin) { create(:admin, email: "boss@bpc.test", password: "secret12") }

    it "returns an access token + admin for valid credentials" do
      post "/api/v1/admin/auth/login", params: { email: "boss@bpc.test", password: "secret12" }, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["access"]).to be_present
      expect(response.parsed_body.dig("admin", "email")).to eq("boss@bpc.test")
      expect(response.headers["Authorization"]).to start_with("Bearer ")
    end

    it "rejects a wrong password" do
      post "/api/v1/admin/auth/login", params: { email: "boss@bpc.test", password: "nope" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "rejects a deactivated admin" do
      admin.update!(active: false)
      post "/api/v1/admin/auth/login", params: { email: "boss@bpc.test", password: "secret12" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end

    it "rejects employee credentials (login isolation)" do
      create(:employee, email: "carer@bpc.test", password: "secret12")
      post "/api/v1/admin/auth/login", params: { email: "carer@bpc.test", password: "secret12" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "POST /api/v1/staff/auth/login" do
    before do
      create(:employee, email: "carer@bpc.test", password: "secret12")
      create(:admin, email: "boss@bpc.test", password: "secret12")
    end

    it "logs in an employee" do
      post "/api/v1/staff/auth/login", params: { email: "carer@bpc.test", password: "secret12" }, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["access"]).to be_present
      expect(response.parsed_body.dig("employee", "role")).to eq("carer")
    end

    it "rejects admin credentials (login isolation)" do
      post "/api/v1/staff/auth/login", params: { email: "boss@bpc.test", password: "secret12" }, as: :json
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
