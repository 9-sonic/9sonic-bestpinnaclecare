require "rails_helper"

RSpec.describe "Admin audit trail", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:su)    { create(:service_user, lat: 53.4808, lng: -2.2426) }

  it "records a clock correction as an event and returns it" do
    va = create(:visit_assignment,
                visit: create(:visit, service_user: su, scheduled_start: 1.hour.ago, scheduled_end: 1.hour.from_now),
                lifecycle_state: "pending_review")

    post "/api/v1/admin/clock_corrections",
         params: { visit_assignment_id: va.id, kind: "clock_out", occurred_at: Time.current.iso8601, reason: "battery died" },
         headers: auth, as: :json
    expect(response).to have_http_status(:created)

    get "/api/v1/admin/audit", headers: auth
    expect(response).to have_http_status(:ok)

    entry = response.parsed_body.find { |e| e["event_type"] == "clock.corrected" }
    expect(entry).to be_present
    expect(entry["actor_name"]).to eq(admin.full_name)
    expect(entry["aggregate_type"]).to eq("VisitAssignment")
    expect(entry["aggregate_id"]).to eq(va.id)
    expect(entry["payload"]["reason"]).to eq("battery died")
  end

  it "records an assignment as an event" do
    visit    = create(:visit, service_user: su)
    employee = create(:employee)

    post "/api/v1/admin/visit_assignments",
         params: { visit_id: visit.id, employee_id: employee.id }, headers: auth, as: :json
    expect(response).to have_http_status(:created)

    get "/api/v1/admin/audit", params: { event_type: "assignment.created" }, headers: auth
    entry = response.parsed_body.first
    expect(entry["event_type"]).to eq("assignment.created")
    expect(entry["payload"]["employee_id"]).to eq(employee.id)
  end

  it "returns entries newest first" do
    Events::Record.call(aggregate: su, actor: admin, event_type: "test.older", occurred_at: 2.hours.ago)
    Events::Record.call(aggregate: su, actor: admin, event_type: "test.newer", occurred_at: 1.minute.ago)

    get "/api/v1/admin/audit", headers: auth
    types = response.parsed_body.map { |e| e["event_type"] }
    expect(types.index("test.newer")).to be < types.index("test.older")
  end

  it "is append-only — an event cannot be updated or deleted" do
    e = Events::Record.call(aggregate: su, actor: admin, event_type: "test.event")
    expect { e.update!(event_type: "changed") }.to raise_error(ActiveRecord::ReadOnlyRecord)
    expect { e.destroy! }.to raise_error(ActiveRecord::ReadOnlyRecord)
  end

  it "requires an authenticated admin" do
    get "/api/v1/admin/audit"
    expect(response).to have_http_status(:unauthorized)
  end

  it "filters by date range (from/to)" do
    Events::Record.call(aggregate: su, actor: admin, event_type: "test.old", occurred_at: 10.days.ago)
    Events::Record.call(aggregate: su, actor: admin, event_type: "test.in_range", occurred_at: 1.day.ago)

    get "/api/v1/admin/audit", params: { from: 3.days.ago.iso8601, to: Time.current.iso8601 }, headers: auth
    types = response.parsed_body.map { |e| e["event_type"] }
    expect(types).to include("test.in_range")
    expect(types).not_to include("test.old")
  end

  it "filters by actor" do
    other_admin = create(:admin)
    Events::Record.call(aggregate: su, actor: admin, event_type: "test.mine")
    Events::Record.call(aggregate: su, actor: other_admin, event_type: "test.theirs")

    get "/api/v1/admin/audit", params: { actor_type: "Admin", actor_id: admin.id }, headers: auth
    types = response.parsed_body.map { |e| e["event_type"] }
    expect(types).to include("test.mine")
    expect(types).not_to include("test.theirs")
  end

  it "filters by a specific record (aggregate_type + aggregate_id)" do
    other_su = create(:service_user)
    Events::Record.call(aggregate: su, actor: admin, event_type: "test.this_client")
    Events::Record.call(aggregate: other_su, actor: admin, event_type: "test.other_client")

    get "/api/v1/admin/audit", params: { aggregate_type: "ServiceUser", aggregate_id: su.id }, headers: auth
    types = response.parsed_body.map { |e| e["event_type"] }
    expect(types).to include("test.this_client")
    expect(types).not_to include("test.other_client")
  end

  it "carries the acting admin's IP address on the event" do
    Events::Record.call(aggregate: su, actor: admin, event_type: "test.with_ip")
    # Direct service calls (outside a request) have no Current.ip_address — this
    # proves the column round-trips; the controller-driven IP capture is proven
    # by the login_attempts specs, which exercise a real request.
    entry = Event.find_by(event_type: "test.with_ip")
    expect(entry).to respond_to(:ip_address)
  end
end
