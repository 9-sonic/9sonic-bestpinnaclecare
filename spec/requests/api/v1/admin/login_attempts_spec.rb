require "rails_helper"

RSpec.describe "Login attempt audit", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }

  it "records a successful admin login with IP and user agent" do
    expect {
      post "/api/v1/admin/auth/login",
           params: { email: admin.email, password: admin.password },
           headers: { "User-Agent" => "RSpec-Test/1.0" }, as: :json
    }.to change(LoginAttempt, :count).by(1)
    expect(response).to have_http_status(:ok)

    attempt = LoginAttempt.last
    expect(attempt.success).to eq(true)
    expect(attempt.resource).to eq(admin)
    expect(attempt.scope).to eq("admin")
    expect(attempt.attempted_email).to eq(admin.email)
    expect(attempt.user_agent).to eq("RSpec-Test/1.0")
    expect(attempt.ip_address).to be_present
  end

  it "records a failed login with the wrong password" do
    expect {
      post "/api/v1/admin/auth/login", params: { email: admin.email, password: "wrong" }, as: :json
    }.to change(LoginAttempt, :count).by(1)

    attempt = LoginAttempt.last
    expect(attempt.success).to eq(false)
    expect(attempt.failure_reason).to eq("invalid_credentials")
    expect(attempt.resource).to eq(admin)
  end

  it "records a failed login against an email that matches no account (no resource to attach to)" do
    expect {
      post "/api/v1/admin/auth/login", params: { email: "nobody@bpc.test", password: "whatever" }, as: :json
    }.to change(LoginAttempt, :count).by(1)

    attempt = LoginAttempt.last
    expect(attempt.success).to eq(false)
    expect(attempt.resource).to be_nil
    expect(attempt.attempted_email).to eq("nobody@bpc.test")
  end

  it "records a staff (employee) login separately from admin, with scope employee" do
    employee = create(:employee)
    post "/api/v1/staff/auth/login", params: { email: employee.email, password: employee.password }, as: :json

    attempt = LoginAttempt.last
    expect(attempt.scope).to eq("employee")
    expect(attempt.resource).to eq(employee)
  end

  describe "GET /api/v1/admin/login_attempts" do
    it "lists attempts newest first" do
      Auth::RecordLoginAttempt.call(scope: :admin, request: nil, resource: admin, success: true)
      Auth::RecordLoginAttempt.call(scope: :admin, request: nil, attempted_email: "x@bpc.test", success: false, failure_reason: "invalid_credentials")

      get "/api/v1/admin/login_attempts", headers: auth
      expect(response).to have_http_status(:ok)
      rows = response.parsed_body
      expect(rows.first["attempted_email"]).to eq("x@bpc.test")
      expect(rows.first["success"]).to eq(false)
    end

    it "filters by resource (a specific carer or admin)" do
      other_admin = create(:admin)
      Auth::RecordLoginAttempt.call(scope: :admin, request: nil, resource: admin, success: true)
      Auth::RecordLoginAttempt.call(scope: :admin, request: nil, resource: other_admin, success: true)

      get "/api/v1/admin/login_attempts", params: { resource_type: "Admin", resource_id: admin.id }, headers: auth
      rows = response.parsed_body
      expect(rows.size).to eq(1)
      expect(rows.first["resource_id"]).to eq(admin.id)
    end

    it "filters by success" do
      Auth::RecordLoginAttempt.call(scope: :admin, request: nil, resource: admin, success: true)
      Auth::RecordLoginAttempt.call(scope: :admin, request: nil, resource: admin, success: false, failure_reason: "invalid_credentials")

      get "/api/v1/admin/login_attempts", params: { success: "false" }, headers: auth
      rows = response.parsed_body
      expect(rows).to all(include("success" => false))
    end

    it "requires an authenticated admin" do
      get "/api/v1/admin/login_attempts"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
