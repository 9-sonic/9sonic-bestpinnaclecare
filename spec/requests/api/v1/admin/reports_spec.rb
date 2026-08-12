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

  it "counts pending_review visits against attendance instead of hiding them" do
    create(:visit_assignment, visit: visit_at(2.hours.ago), lifecycle_state: "completed",
           actual_start: 2.hours.ago, actual_end: 1.hour.ago, worked_minutes: 60)
    create(:visit_assignment, visit: visit_at(3.hours.ago), lifecycle_state: "pending_review")

    get "/api/v1/admin/reports", headers: auth
    summary = response.parsed_body["summary"]
    expect(summary["unresolved"]).to eq(1)
    expect(summary["attendance_pct"]).to eq(50) # 1 done of (1 done + 1 unresolved), not 100
  end

  it "reports location integrity from clock-in geofence results" do
    gesu = create(:service_user, lat: 53.4808, lng: -2.2426, geofence_radius_m: 150)
    v = create(:visit, service_user: gesu, scheduled_start: 20.minutes.ago, scheduled_end: 40.minutes.from_now)
    va = create(:visit_assignment, visit: v, employee: create(:employee))
    # A real on-site clock-in through the pipeline -> geofence pass.
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: Time.current, lat: 53.4808, lng: -2.2426, actor: va.employee
    )

    get "/api/v1/admin/reports", headers: auth
    loc = response.parsed_body["location"]
    expect(loc["clock_ins"]).to be >= 1
    expect(loc["on_site"]).to be >= 1
    expect(loc).to have_key("no_gps_fix")
    expect(loc).to have_key("needs_review")
  end

  it "reports care-task completion across completed visits" do
    v = visit_at(2.hours.ago)
    va = create(:visit_assignment, visit: v, lifecycle_state: "completed",
                actual_start: 2.hours.ago, actual_end: 1.hour.ago, worked_minutes: 60)
    cpi = create(:care_plan_item, service_user: su)
    va.visit_tasks.create!(care_plan_item: cpi, label: cpi.label, done: true, completed_at: Time.current)
    va.visit_tasks.create!(label: "Second task", done: false)

    get "/api/v1/admin/reports", headers: auth
    su_body = response.parsed_body["summary"]
    expect(su_body["tasks_total"]).to eq(2)
    expect(su_body["tasks_done"]).to eq(1)
    expect(su_body["tasks_pct"]).to eq(50)
  end

  it "requires an authenticated admin" do
    get "/api/v1/admin/reports"
    expect(response).to have_http_status(:unauthorized)
  end
end
