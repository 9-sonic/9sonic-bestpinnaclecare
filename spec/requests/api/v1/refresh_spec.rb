require "rails_helper"

RSpec.describe "Token refresh", type: :request do
  let!(:employee) { create(:employee, email: "carer@bpc.test", password: "secret12") }

  def login
    post "/api/v1/staff/auth/login", params: { email: "carer@bpc.test", password: "secret12" }, as: :json
    response.parsed_body
  end

  it "login returns access, access_expires_at and a refresh token" do
    body = login
    expect(body["access"]).to be_present
    expect(body["access_expires_at"]).to be_present
    expect(body["refresh_token"]).to match(/\A\d+\./)
  end

  it "rotates a refresh token for a fresh access token" do
    refresh = login["refresh_token"]
    post "/api/v1/auth/refresh", params: { refresh_token: refresh }, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["access"]).to be_present
    expect(response.parsed_body["refresh_token"]).to be_present
    expect(response.parsed_body["refresh_token"]).not_to eq(refresh)

    # the new access token authorises /me
    get "/api/v1/staff/me", headers: { "Authorization" => "Bearer #{response.parsed_body['access']}" }
    expect(response).to have_http_status(:ok)
  end

  it "treats reuse of a rotated (revoked) token as theft and rejects it" do
    refresh = login["refresh_token"]
    post "/api/v1/auth/refresh", params: { refresh_token: refresh }, as: :json
    new_refresh = response.parsed_body["refresh_token"]

    # reusing the OLD one -> 401 and the whole chain is revoked
    post "/api/v1/auth/refresh", params: { refresh_token: refresh }, as: :json
    expect(response).to have_http_status(:unauthorized)

    # the token issued from the stolen chain is now dead too
    post "/api/v1/auth/refresh", params: { refresh_token: new_refresh }, as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "revokes a refresh token on logout of the refresh" do
    refresh = login["refresh_token"]
    delete "/api/v1/auth/refresh", params: { refresh_token: refresh }, as: :json
    expect(response).to have_http_status(:no_content)
    post "/api/v1/auth/refresh", params: { refresh_token: refresh }, as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "rejects a garbage refresh token" do
    post "/api/v1/auth/refresh", params: { refresh_token: "999.nope" }, as: :json
    expect(response).to have_http_status(:unauthorized)
  end
end
