require "rails_helper"

RSpec.describe Lifecycle::EvaluateAssignment do
  let(:su) { create(:service_user) }

  def assignment(start_offset:, end_offset:, state: "scheduled")
    visit = create(:visit, service_user: su,
                   scheduled_start: Time.current + start_offset, scheduled_end: Time.current + end_offset)
    create(:visit_assignment, visit: visit, lifecycle_state: state)
  end

  it "opens the check-in window shortly before start" do
    va = assignment(start_offset: 10.minutes, end_offset: 1.hour)
    described_class.call(va)
    expect(va.reload.lifecycle_state).to eq("check_in_window")
  end

  it "enters grace once start passes with no clock-in" do
    va = assignment(start_offset: -1.minute, end_offset: 1.hour, state: "check_in_window")
    described_class.call(va)
    expect(va.reload.lifecycle_state).to eq("grace_period")
  end

  it "marks missed after the grace threshold and raises an alert" do
    va = assignment(start_offset: -40.minutes, end_offset: 1.hour, state: "grace_period")
    described_class.call(va)
    expect(va.reload.lifecycle_state).to eq("missed")
    expect(Alert.where(subject: va, alert_type: "missed_visit", state: "open")).to exist
  end

  it "stays in grace while still inside the 15 min grace window (no premature alert)" do
    va = assignment(start_offset: -10.minutes, end_offset: 1.hour, state: "grace_period")
    described_class.call(va)
    expect(va.reload.lifecycle_state).to eq("grace_period")
    expect(Alert.where(subject: va, alert_type: "missed_visit")).not_to exist
  end

  it "escalates as soon as the 15 min grace window passes — early enough to reassign" do
    va = assignment(start_offset: -16.minutes, end_offset: 1.hour, state: "grace_period")
    described_class.call(va)
    expect(va.reload.lifecycle_state).to eq("missed")
    expect(Alert.where(subject: va, alert_type: "missed_visit", state: "open")).to exist
  end

  it "goes overdue past end + overdue threshold" do
    va = assignment(start_offset: -2.hours, end_offset: -70.minutes, state: "in_progress")
    described_class.call(va)
    expect(va.reload.lifecycle_state).to eq("overdue")
    expect(Alert.where(subject: va, alert_type: "no_clock_out", state: "open")).to exist
  end

  it "auto-closes a very overdue visit to pending_review + flag" do
    va = assignment(start_offset: -6.hours, end_offset: -5.hours, state: "in_progress")
    described_class.call(va)
    expect(va.reload.lifecycle_state).to eq("pending_review")
    expect(va.reload.flags).to include("auto_closed")
  end

  it "marks a clock-in within the grace window as late" do
    su2 = create(:service_user, lat: 53.4808, lng: -2.2426)
    # Started 5 min ago; grace is 15 min, so this tap is late-but-within-grace.
    visit = create(:visit, service_user: su2, scheduled_start: 5.minutes.ago, scheduled_end: 1.hour.from_now)
    va = create(:visit_assignment, visit: visit)
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: Time.current, lat: 53.4808, lng: -2.2426, actor: va.employee
    )
    expect(va.reload.lifecycle_state).to eq("late")
  end

  it "flags a clock-in after the grace window for review (turned up properly late)" do
    su2 = create(:service_user, lat: 53.4808, lng: -2.2426)
    # Started 20 min ago; past the 15 min grace, so the office reviews it.
    visit = create(:visit, service_user: su2, scheduled_start: 20.minutes.ago, scheduled_end: 1.hour.from_now)
    va = create(:visit_assignment, visit: visit)
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: Time.current, lat: 53.4808, lng: -2.2426, actor: va.employee
    )
    expect(va.reload.lifecycle_state).to eq("pending_review")
  end
end
