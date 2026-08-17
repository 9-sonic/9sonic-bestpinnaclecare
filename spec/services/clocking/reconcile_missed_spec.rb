require "rails_helper"

# A carer clocks in offline (dead zone), the timer marks the visit "missed"
# before the tap syncs, then the tap arrives. The honest record must win: the
# synced clock-in reconciles the visit and clears the false "missed" alert.
# Only the offline-sync path (on_block: :flag) may do this — a live tap after
# the office was alerted stays rejected.
RSpec.describe Clocking::RecordClockEvent, "reconciling a missed visit" do
  let(:su) { create(:service_user, lat: 53.4808, lng: -2.2426) }

  def missed_assignment(start_offset:)
    visit = create(:visit, service_user: su,
                   scheduled_start: Time.current + start_offset, scheduled_end: 1.hour.from_now)
    va = create(:visit_assignment, visit: visit, lifecycle_state: "missed")
    Alert.create!(subject: va, alert_type: "missed_visit", severity: "high", state: "open")
    va
  end

  it "reconciles a missed visit when an on-time offline clock-in syncs in" do
    va = missed_assignment(start_offset: -20.minutes)
    # The tap was actually taken at the scheduled start — within grace — but only
    # synced now. Original tap time is what matters.
    res = described_class.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: va.visit.scheduled_start, lat: 53.4808, lng: -2.2426,
      actor: va.employee, on_block: :flag
    )

    expect(res.status).to eq(:ok)
    expect(va.reload.lifecycle_state).to be_in(%w[in_progress late pending_review])
    expect(va.actual_start).to be_within(1.second).of(va.visit.scheduled_start)
  end

  it "auto-resolves the open missed_visit alert on reconciliation" do
    va = missed_assignment(start_offset: -20.minutes)
    described_class.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: va.visit.scheduled_start, lat: 53.4808, lng: -2.2426,
      actor: va.employee, on_block: :flag
    )
    expect(Alert.where(subject: va, alert_type: "missed_visit", state: "open")).not_to exist
    expect(Alert.find_by(subject: va, alert_type: "missed_visit").state).to eq("resolved")
  end

  it "keeps the append-only clock event as proof of attendance" do
    va = missed_assignment(start_offset: -20.minutes)
    expect do
      described_class.call(
        visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
        occurred_at: va.visit.scheduled_start, lat: 53.4808, lng: -2.2426,
        actor: va.employee, on_block: :flag
      )
    end.to change { ClockEvent.where(visit_assignment: va, kind: "clock_in").count }.by(1)
  end

  it "flags for review when the synced tap was actually taken after grace" do
    va = missed_assignment(start_offset: -30.minutes)
    # Tap taken 20 min after start — past the 15 min grace, so it needs review.
    described_class.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: va.visit.scheduled_start + 20.minutes, lat: 53.4808, lng: -2.2426,
      actor: va.employee, on_block: :flag
    )
    expect(va.reload.lifecycle_state).to eq("pending_review")
  end

  it "does NOT let a LIVE tap reconcile a missed visit (stays rejected)" do
    va = missed_assignment(start_offset: -20.minutes)
    res = described_class.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: Time.current, lat: 53.4808, lng: -2.2426,
      actor: va.employee, on_block: :reject
    )
    expect(res.status).to eq(:blocked)
    expect(res.error).to eq("visit_not_clockable")
    expect(va.reload.lifecycle_state).to eq("missed")
  end
end
