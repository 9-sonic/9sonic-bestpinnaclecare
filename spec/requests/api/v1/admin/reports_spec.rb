require "rails_helper"

RSpec.describe "Admin reports", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:su)    { create(:service_user) }

  def visit_at(start)
    create(:visit, service_user: su, scheduled_start: start, scheduled_end: start + 1.hour)
  end

  it "aggregates completed, late and missed over the range" do
    create(:visit_assignment, visit: visit_at(2.hours.ago), lifecycle_state: "completed",
           actual_start: 2.hours.ago, actual_end: 1.hour.ago, worked_minutes: 60)

    late_v = visit_at(3.hours.ago)
    create(:visit_assignment, visit: late_v, lifecycle_state: "completed",
           actual_start: 3.hours.ago + 40.minutes, actual_end: 2.hours.ago, worked_minutes: 60)

    create(:visit_assignment, visit: visit_at(4.hours.ago), lifecycle_state: "missed")

    get "/api/v1/admin/reports", headers: auth
    expect(response).to have_http_status(:ok)

    body = response.parsed_body
    expect(body["summary"]["verified_hours"]).to eq(2.0)
    expect(body["summary"]).to have_key("attendance_pct")
    expect(body["summary"]).to have_key("on_time_pct")
    expect(body["attendance_by_day"]).to be_an(Array)
    expect(body["hours_by_carer"]).to be_an(Array)
    expect(body["late_by_client"]).to be_an(Array)
  end

  it "requires an authenticated admin" do
    get "/api/v1/admin/reports"
    expect(response).to have_http_status(:unauthorized)
  end
end
