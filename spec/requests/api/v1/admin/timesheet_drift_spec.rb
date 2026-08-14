require "rails_helper"

RSpec.describe "Timesheet stays in sync with clock corrections", type: :request do
  let(:admin) { create(:admin, role: :registered_manager) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:su)    { create(:service_user, lat: 53.4808, lng: -2.2426, geofence_radius_m: 150) }

  # A completed visit earlier today with real clock events + a built line.
  def completed_visit(worked:)
    start = 3.hours.ago
    v  = create(:visit, service_user: su, scheduled_start: start, scheduled_end: start + 1.hour)
    va = create(:visit_assignment, visit: v, employee: create(:employee))
    clock(va, "clock_in", start)
    clock(va, "clock_out", start + (worked / 60.0).hours)
    period = Timesheets::BuildPeriod.call(starts_on: start.to_date.beginning_of_week)
    [ va, period ]
  end

  def clock(va, kind, at)
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: kind, client_event_id: SecureRandom.uuid,
      occurred_at: at, lat: 53.4808, lng: -2.2426, actor: va.employee
    )
  end

  it "rebuilds the timesheet line after a clock correction" do
    va, period = completed_visit(worked: 60)
    line = period.timesheet_lines.find_by(visit_assignment_id: va.id)
    expect(line.worked_minutes).to eq(60)

    # Correct the clock-out to 30 min earlier -> ~30 worked. corrects_id supersedes
    # the original clock-out (as the amend UI does).
    ci = va.effective_clock_in
    post "/api/v1/admin/clock_corrections",
         params: { visit_assignment_id: va.id, kind: "clock_out",
                   occurred_at: (ci.occurred_at + 30.minutes).iso8601, reason: "left early",
                   corrects_id: va.effective_clock_out.id },
         headers: auth, as: :json
    expect(response).to have_http_status(:created)
    expect(response.parsed_body["timesheet_status"]).to eq("rebuilt")
    expect(line.reload.worked_minutes).to eq(30) # pay follows the correction
  end

  it "does not rewrite a LOCKED period, and flags it for re-approval" do
    va, period = completed_visit(worked: 60)
    period.update!(status: "locked", locked_at: Time.current)
    ci = va.effective_clock_in

    post "/api/v1/admin/clock_corrections",
         params: { visit_assignment_id: va.id, kind: "clock_out",
                   occurred_at: (ci.occurred_at + 30.minutes).iso8601, reason: "adjust",
                   corrects_id: va.effective_clock_out.id },
         headers: auth, as: :json
    expect(response.parsed_body["timesheet_status"]).to eq("locked")
    expect(period.timesheet_lines.find_by(visit_assignment_id: va.id).worked_minutes).to eq(60) # untouched
    expect(Event.where(event_type: "timesheet.needs_reapproval")).to exist
  end
end
