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
end
