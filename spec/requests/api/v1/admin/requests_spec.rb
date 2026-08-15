require "rails_helper"

RSpec.describe "Admin carer requests", type: :request do
  let(:admin)    { create(:admin) }
  let(:auth)     { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:employee) { create(:employee) }

  def request_record(kind: "swap", state: "pending")
    CarerRequest.create!(employee: employee, kind: kind, state: state, summary: "#{kind} request")
  end

  it "lists requests pending first" do
    request_record(state: "approved")
    pending = request_record(state: "pending")

    get "/api/v1/admin/requests", headers: auth
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["items"].first["id"]).to eq(pending.id)
  end

  it "filters by kind" do
    request_record(kind: "leave")
    request_record(kind: "swap")
    get "/api/v1/admin/requests", params: { kind: "leave" }, headers: auth
    expect(response.parsed_body["items"].map { |r| r["kind"] }.uniq).to eq([ "leave" ])
  end

  it "approves a request and audits it" do
    req = request_record
    post "/api/v1/admin/requests/#{req.id}/approve", params: { note: "cover arranged" }, headers: auth, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["state"]).to eq("approved")
    expect(req.reload.decided_by).to eq(admin)

    get "/api/v1/admin/audit", params: { event_type: "request.approved" }, headers: auth
    expect(response.parsed_body.first["event_type"]).to eq("request.approved")
  end

  it "declines a request" do
    req = request_record
    post "/api/v1/admin/requests/#{req.id}/decline", headers: auth, as: :json
    expect(response.parsed_body["state"]).to eq("declined")
  end

  it "lets a carer raise a request from the staff API" do
    emp_auth = { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" }
    post "/api/v1/staff/requests",
         params: { kind: "overtime", summary: "Available for weekend hours" }, headers: emp_auth, as: :json
    expect(response).to have_http_status(:created)
    expect(employee.carer_requests.count).to eq(1)
  end
end
