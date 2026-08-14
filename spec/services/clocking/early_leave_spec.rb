require "rails_helper"

RSpec.describe "Early clock-out flags for review (never blocks)", type: :model do
  let(:su) { create(:service_user, lat: 53.4808, lng: -2.2426, geofence_radius_m: 150) }
  # Visit ends in ~50 min from now; clocking out now is well before end.
  let(:va) { create(:visit_assignment, visit: create(:visit, service_user: su, scheduled_start: 10.minutes.ago, scheduled_end: 50.minutes.from_now), employee: create(:employee)) }

  def clock(kind, at = Time.current)
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: kind, client_event_id: SecureRandom.uuid,
      occurred_at: at, lat: 53.4808, lng: -2.2426, actor: va.employee
    )
  end

  before { Setting.instance.update!(early_leave_tolerance_minutes: 10) }

  it "allows an early clock-out but routes the visit to pending_review" do
    clock("clock_in", 10.minutes.ago)
    res = clock("clock_out", Time.current) # ~50 min before scheduled_end
    expect(res.status).to eq(:ok) # not blocked
    expect(va.reload.lifecycle_state).to eq("pending_review")
  end

  it "completes normally when clocking out within tolerance of the end" do
    v = create(:visit, service_user: su, scheduled_start: 1.hour.ago, scheduled_end: 5.minutes.from_now)
    va2 = create(:visit_assignment, visit: v, employee: create(:employee))
    Clocking::RecordClockEvent.call(visit_assignment: va2, kind: "clock_in", client_event_id: SecureRandom.uuid, occurred_at: 1.hour.ago, lat: 53.4808, lng: -2.2426, actor: va2.employee)
    res = Clocking::RecordClockEvent.call(visit_assignment: va2, kind: "clock_out", client_event_id: SecureRandom.uuid, occurred_at: Time.current, lat: 53.4808, lng: -2.2426, actor: va2.employee)
    expect(res.status).to eq(:ok)
    expect(va2.reload.lifecycle_state).to eq("completed") # within 10-min tolerance
  end
end
