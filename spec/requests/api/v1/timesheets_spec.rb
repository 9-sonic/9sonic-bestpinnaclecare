require "rails_helper"

RSpec.describe "Timesheets / attendance", type: :request do
  let(:manager)    { create(:admin, role: :manager) }
  let(:admin_auth) { { "Authorization" => "Bearer #{jwt_for(manager, :admin)}" } }
  let(:employee)   { create(:employee) }
  let(:emp_auth)   { { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" } }
  let(:su)         { create(:service_user, lat: 53.4808, lng: -2.2426) }
  let(:period_start) { Date.current.beginning_of_week }

  def completed_assignment(worked: 45, state: "completed", flags: [])
    start = period_start.to_time + 8.hours
    visit = create(:visit, service_user: su, scheduled_start: start, scheduled_end: start + 45.minutes)
    create(:visit_assignment, visit: visit, employee: employee, lifecycle_state: state, worked_minutes: worked, flags: flags)
  end

  it "builds a period, approves it, exports CSV, and the carer sees their line" do
    completed_assignment(worked: 40)

    post "/api/v1/admin/timesheet_periods", params: { starts_on: period_start.iso8601 }, headers: admin_auth, as: :json
    expect(response).to have_http_status(:created)
    period_id = response.parsed_body["id"]
    expect(response.parsed_body["lines"].size).to eq(1)
    expect(response.parsed_body["lines"].first["worked_minutes"]).to eq(40)

    post "/api/v1/admin/timesheet_periods/#{period_id}/approve", headers: admin_auth
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["status"]).to eq("approved")

    get "/api/v1/admin/timesheet_exports/#{period_id}", headers: admin_auth
    expect(response).to have_http_status(:ok)
    expect(response.body).to include(employee.full_name)

    get "/api/v1/admin/timesheet_exports/#{period_id}?type=xlsx", headers: admin_auth
    expect(response.headers["Content-Type"]).to include("spreadsheetml")

    get "/api/v1/staff/timesheet", headers: emp_auth
    expect(response.parsed_body.first["worked_minutes"]).to eq(40)
  end

  it "blocks approval while a line is auto-closed / pending review" do
    completed_assignment(state: "pending_review", flags: [ "auto_closed" ])
    post "/api/v1/admin/timesheet_periods", params: { starts_on: period_start.iso8601 }, headers: admin_auth, as: :json
    period_id = response.parsed_body["id"]

    post "/api/v1/admin/timesheet_periods/#{period_id}/approve", headers: admin_auth
    expect(response).to have_http_status(422)
    expect(response.parsed_body["error"]).to eq("unconfirmed_lines")
  end

  it "lets a carer raise a dispute an admin resolves" do
    completed_assignment(worked: 30)
    post "/api/v1/admin/timesheet_periods", params: { starts_on: period_start.iso8601 }, headers: admin_auth, as: :json
    line_id = response.parsed_body["lines"].first["id"]

    post "/api/v1/staff/disputes", params: { timesheet_line_id: line_id, reason: "I worked longer" }, headers: emp_auth, as: :json
    expect(response).to have_http_status(:created)
    dispute_id = response.parsed_body["id"]

    post "/api/v1/admin/timesheet_disputes/#{dispute_id}/resolve", params: { resolution_note: "Adjusted" }, headers: admin_auth, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["state"]).to eq("resolved")
  end

  it "forbids a coordinator from approving" do
    completed_assignment
    post "/api/v1/admin/timesheet_periods", params: { starts_on: period_start.iso8601 }, headers: admin_auth, as: :json
    period_id = response.parsed_body["id"]
    coord = create(:admin, role: :coordinator)
    post "/api/v1/admin/timesheet_periods/#{period_id}/approve",
         headers: { "Authorization" => "Bearer #{jwt_for(coord, :admin)}" }
    expect(response).to have_http_status(:forbidden)
  end
end
