require "rails_helper"

RSpec.describe AttendanceAudit::Build do
  let(:su) { create(:service_user, first_name: "Amber", last_name: "Kingham", lat: 51.406984, lng: -1.250699) }

  def visit_at(start, length: 45.minutes)
    create(:visit, service_user: su, scheduled_start: start, scheduled_end: start + length)
  end

  def clock(va, kind, at:, lat: 51.406984, lng: -1.250699, on_block: :reject)
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: kind, client_event_id: SecureRandom.uuid,
      occurred_at: at, lat: lat, lng: lng, actor: va.employee, on_block: on_block
    )
  end

  it "builds one row per assigned visit in the range, carer + client named" do
    v  = visit_at(2.hours.ago)
    va = create(:visit_assignment, visit: v)
    clock(va, "clock_in", at: v.scheduled_start)

    rows = described_class.call(from: 1.day.ago, to: 1.day.from_now)
    expect(rows.size).to eq(1)
    expect(rows.first.staff).to eq(va.employee.full_name)
    expect(rows.first.service_user).to eq("Amber Kingham")
  end

  it "excludes visits outside the date range" do
    old_v = visit_at(10.days.ago)
    create(:visit_assignment, visit: old_v)

    rows = described_class.call(from: 2.days.ago, to: Time.current)
    expect(rows).to be_empty
  end

  it "excludes cancelled assignments" do
    v = visit_at(1.hour.ago)
    create(:visit_assignment, visit: v, lifecycle_state: "cancelled")

    expect(described_class.call(from: 1.day.ago, to: 1.day.from_now)).to be_empty
  end

  it "captures the tap time, metres from home, and a maps link from real clock data" do
    v  = visit_at(90.minutes.ago)
    va = create(:visit_assignment, visit: v)
    clock(va, "clock_in", at: v.scheduled_start)

    row = described_class.call(from: 1.day.ago, to: 1.day.from_now).first
    expect(row.clocked_in).to be_present
    expect(row.metres_in).to be_a(Numeric)
    expect(row.map_in).to start_with("https://www.google.com/maps/dir/")
  end

  it "reports lateness in whole minutes, and 0 (never negative) when early or on time" do
    v  = visit_at(2.hours.ago)
    va = create(:visit_assignment, visit: v)
    clock(va, "clock_in", at: v.scheduled_start + 8.minutes) # 8 late
    clock(va, "clock_out", at: v.scheduled_end - 3.minutes)  # early -> 0

    row = described_class.call(from: 1.day.ago, to: 1.day.from_now).first
    expect(row.late_in).to eq(8)
    expect(row.late_out).to eq(0)
  end

  it "flags an offline-synced tap as offline, and a live tap as not" do
    v  = visit_at(2.hours.ago)
    va = create(:visit_assignment, visit: v)
    clock(va, "clock_in",  at: v.scheduled_start, on_block: :reject) # live
    clock(va, "clock_out", at: v.scheduled_end,   on_block: :flag)   # offline sync

    row = described_class.call(from: 1.day.ago, to: 1.day.from_now).first
    expect(row.offline_in).to eq("No")
    expect(row.offline_out).to eq("Yes")
  end

  it "computes the confidence Index as distance/accuracy, clamped to [1.0, 35.0]" do
    v  = visit_at(1.hour.ago)
    va = create(:visit_assignment, visit: v)
    # Force a known distance + accuracy on the clock-in event, then read the row.
    clock(va, "clock_in", at: v.scheduled_start)
    ci = va.effective_clock_in
    ci.update_columns(distance_from_site_m: 18, accuracy_m: 5) # 18/5 = 3.6

    row = described_class.call(from: 1.day.ago, to: 1.day.from_now).first
    expect(row.index_in).to eq(3.6)
  end

  it "floors the Index at 1.0 and caps it at 35.0" do
    v  = visit_at(1.hour.ago)
    va = create(:visit_assignment, visit: v)
    clock(va, "clock_in", at: v.scheduled_start)
    ci = va.effective_clock_in

    ci.update_columns(distance_from_site_m: 2, accuracy_m: 8) # 0.25 -> floored to 1.0
    expect(described_class.call(from: 1.day.ago, to: 1.day.from_now).first.index_in).to eq(1.0)

    ci.update_columns(distance_from_site_m: 400, accuracy_m: 3) # 133 -> capped at 35.0
    expect(described_class.call(from: 1.day.ago, to: 1.day.from_now).first.index_in).to eq(35.0)
  end

  it "leaves Index blank when there is no accuracy fix (never fabricated)" do
    v  = visit_at(1.hour.ago)
    va = create(:visit_assignment, visit: v)
    clock(va, "clock_in", at: v.scheduled_start)
    va.effective_clock_in.update_columns(distance_from_site_m: 10, accuracy_m: nil)

    expect(described_class.call(from: 1.day.ago, to: 1.day.from_now).first.index_in).to be_nil
  end
end
