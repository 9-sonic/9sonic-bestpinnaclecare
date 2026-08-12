require "rails_helper"

RSpec.describe "Admin carer 360", type: :request do
  let(:admin)    { create(:admin) }
  let(:auth)     { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:su)       { create(:service_user, lat: 53.4808, lng: -2.2426) }
  let(:carer)    { create(:employee) }
  let(:visit)    { create(:visit, service_user: su, scheduled_start: 30.minutes.ago, scheduled_end: 30.minutes.from_now) }
  let(:va)       { create(:visit_assignment, visit: visit, employee: carer) }

  # A clock event written through the real service so append-only rules hold.
  def clock_in!
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: Time.current, lat: 53.4808, lng: -2.2426, actor: carer
    )
  end

  it "GET profile returns the carer summary, counts and recent slices" do
    va
    VisitNote.create!(visit_assignment: va, author: carer, body: "All well today", client_note_id: SecureRandom.uuid)
    clock_in!
    carer.carer_requests.create!(kind: "drop", summary: "Please cancel Friday", state: "pending")

    get "/api/v1/admin/employees/#{carer.id}/profile", headers: auth
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body["employee"]["id"]).to eq(carer.id)
    expect(body["counts"]).to include("visits" => 1, "notes" => 1, "open_requests" => 1)
    expect(body["recent_notes"].first).to include("body" => "All well today", "service_user" => su.full_name)
    expect(body["recent_clock"].first["kind"]).to eq("clock_in")
    expect(body["open_requests"].first["summary"]).to eq("Please cancel Friday")
  end

  it "GET visits returns this carer's assignments, paginated" do
    va
    get "/api/v1/admin/employees/#{carer.id}/visits", headers: auth
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body).to include("page" => 1, "total" => 1)
    expect(body["items"].first["visit_id"]).to eq(visit.id)
  end

  it "GET notes returns only notes this carer wrote" do
    other = create(:employee)
    other_va = create(:visit_assignment, visit: create(:visit, service_user: su), employee: other)
    VisitNote.create!(visit_assignment: va, author: carer, body: "Mine", client_note_id: SecureRandom.uuid)
    VisitNote.create!(visit_assignment: other_va, author: other, body: "Theirs", client_note_id: SecureRandom.uuid)

    get "/api/v1/admin/employees/#{carer.id}/notes", headers: auth
    bodies = response.parsed_body["items"].map { |n| n["body"] }
    expect(bodies).to eq(["Mine"])
  end

  it "GET clock_events returns this carer's clock history" do
    clock_in!
    get "/api/v1/admin/employees/#{carer.id}/clock_events", headers: auth
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["items"].first).to include("kind" => "clock_in", "service_user" => su.full_name)
  end

  it "GET timesheet_lines returns this carer's worked-hours lines" do
    period = TimesheetPeriod.create!(starts_on: Date.current.beginning_of_week, ends_on: Date.current.end_of_week)
    carer.timesheet_lines.create!(
      timesheet_period: period, visit_assignment: va, work_date: Date.current,
      scheduled_minutes: 60, worked_minutes: 58, break_minutes: 0
    )
    get "/api/v1/admin/employees/#{carer.id}/timesheet_lines", headers: auth
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["items"].first).to include("worked_minutes" => 58)
  end

  it "GET requests returns all of this carer's requests" do
    carer.carer_requests.create!(kind: "leave", summary: "Annual leave", state: "pending")
    carer.carer_requests.create!(kind: "swap", summary: "Swap Tuesday", state: "approved")
    get "/api/v1/admin/employees/#{carer.id}/requests", headers: auth
    expect(response.parsed_body["total"]).to eq(2)
  end
end
