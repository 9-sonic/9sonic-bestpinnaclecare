require "rails_helper"

# "Late" is a whole-minute concept — the same as the attendance report, which
# floors seconds. A tap a few seconds past the scheduled minute is clock
# precision, not lateness; a full minute or more late is late.
#
# Scheduled time is anchored near `now` so the tap doesn't trip the clock-skew
# anomaly check (which would park it in pending_review before the late logic).
RSpec.describe Clocking::RecordClockEvent, "late threshold on clock-in" do
  let(:su) { create(:service_user, lat: 53.4808, lng: -2.2426) }

  # Schedule a visit starting `start_offset` from now; clock in `tap_after`
  # seconds past that scheduled start. Return the resulting lifecycle state.
  def state_for(tap_after_seconds)
    start = Time.current.change(sec: 0) # a clean minute boundary
    visit = create(:visit, service_user: su, status: "published",
                   scheduled_start: start, scheduled_end: start + 1.hour)
    va = create(:visit_assignment, visit: visit, lifecycle_state: "scheduled")
    described_class.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: start + tap_after_seconds.seconds, lat: su.lat, lng: su.lng,
      accuracy_m: 10, actor: va.employee
    )
    va.reload.lifecycle_state
  end

  it "is NOT late exactly on the scheduled minute" do
    expect(state_for(0)).to eq("in_progress")
  end

  it "is NOT late one second past the scheduled start (19:00:01)" do
    expect(state_for(1)).to eq("in_progress")
  end

  it "is NOT late 59 seconds past the scheduled start" do
    expect(state_for(59)).to eq("in_progress")
  end

  it "IS late a full minute past the scheduled start (19:01:00)" do
    expect(state_for(60)).to eq("late")
  end

  it "IS late five minutes past, still within the grace window" do
    expect(state_for(5 * 60)).to eq("late")
  end
end
