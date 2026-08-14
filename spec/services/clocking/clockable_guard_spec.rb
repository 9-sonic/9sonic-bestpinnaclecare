require "rails_helper"

RSpec.describe "Clock lifecycle guard", type: :model do
  let(:su)  { create(:service_user, lat: 53.4808, lng: -2.2426, geofence_radius_m: 150) }
  # scheduled_end ~now so a clock-out completes normally (not flagged early-leave).
  let(:va)  { create(:visit_assignment, visit: create(:visit, service_user: su, scheduled_start: 55.minutes.ago, scheduled_end: 2.minutes.from_now), employee: create(:employee)) }

  def clock(kind, method: "gps")
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: kind, client_event_id: SecureRandom.uuid,
      occurred_at: Time.current, lat: 53.4808, lng: -2.2426, actor: va.employee, method: method,
      reason: (method == "manual_admin" ? "correction" : nil)
    )
  end

  it "refuses clock-out with no prior clock-in" do
    res = clock("clock_out")
    expect(res.status).to eq(:blocked)
    expect(res.error).to eq("not_clocked_in")
  end

  it "refuses a second clock-in" do
    clock("clock_in")
    res = clock("clock_in")
    expect(res.status).to eq(:blocked)
    expect(res.error).to eq("already_clocked_in")
  end

  it "refuses a second clock-out (visit already completed)" do
    clock("clock_in")
    clock("clock_out")
    res = clock("clock_out")
    expect(res.status).to eq(:blocked)
    expect(res.error).to eq("visit_not_clockable") # completed after first clock-out
  end

  it "refuses clocking a cancelled visit" do
    va.update!(lifecycle_state: :cancelled)
    res = clock("clock_in")
    expect(res.status).to eq(:blocked)
    expect(res.error).to eq("visit_not_clockable")
  end

  it "refuses clocking a completed visit" do
    va.update!(lifecycle_state: :completed)
    res = clock("clock_in")
    expect(res.error).to eq("visit_not_clockable")
  end

  it "still lets an admin correction bypass the guard" do
    # manual_admin corrections can write against any state (fixing records).
    res = clock("clock_in", method: "manual_admin")
    expect(res.status).to eq(:ok)
  end
end
