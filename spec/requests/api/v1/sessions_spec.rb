require "rails_helper"

RSpec.describe "Sessions (me + logout)", type: :request do
  let!(:admin) { create(:admin, email: "boss@bpc.test", password: "secret12") }

  def login
    post "/api/v1/admin/auth/login", params: { email: "boss@bpc.test", password: "secret12" }, as: :json
    response.parsed_body["access"]
  end

  it "GET /api/v1/admin/me returns the current admin with a token" do
    get "/api/v1/admin/me", headers: { "Authorization" => "Bearer #{login}" }
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["email"]).to eq("boss@bpc.test")
  end

  it "GET /api/v1/admin/me is unauthorized without a token" do
    get "/api/v1/admin/me"
    expect(response).to have_http_status(:unauthorized)
  end

  it "DELETE /api/v1/auth/logout revokes the token via the denylist" do
    token = login
    delete "/api/v1/auth/logout", headers: { "Authorization" => "Bearer #{token}" }
    expect(response).to have_http_status(:no_content)

    get "/api/v1/admin/me", headers: { "Authorization" => "Bearer #{token}" }
    expect(response).to have_http_status(:unauthorized)
  end

  it "DELETE /api/v1/auth/logout is unauthorized without a token" do
    delete "/api/v1/auth/logout"
    expect(response).to have_http_status(:unauthorized)
  end
end
