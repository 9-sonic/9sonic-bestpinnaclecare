require "rails_helper"

RSpec.describe "Break deduction from worked minutes", type: :model do
  let(:su)  { create(:service_user, lat: 53.4808, lng: -2.2426) }
  let(:va)  { create(:visit_assignment, visit: create(:visit, service_user: su, scheduled_start: 9.hours.ago, scheduled_end: 1.hour.from_now), employee: create(:employee)) }

  def event(kind, at)
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: kind, client_event_id: SecureRandom.uuid,
      occurred_at: at, lat: 53.4808, lng: -2.2426, actor: va.employee, on_block: :flag
    )
  end

  it "subtracts a paired break from worked_minutes" do
    t0 = 8.hours.ago
    event("clock_in",    t0)
    event("break_start", t0 + 3.hours)
    event("break_end",   t0 + 3.hours + 30.minutes)   # 30-min break
    event("clock_out",   t0 + 8.hours)                 # 8h gross

    expect(va.reload.break_minutes).to eq(30)
    expect(va.worked_minutes).to eq(8 * 60 - 30)       # 450, breaks not paid
  end

  it "handles multiple breaks" do
    t0 = 8.hours.ago
    event("clock_in",    t0)
    event("break_start", t0 + 2.hours);   event("break_end", t0 + 2.hours + 15.minutes)
    event("break_start", t0 + 5.hours);   event("break_end", t0 + 5.hours + 20.minutes)
    event("clock_out",   t0 + 8.hours)

    expect(va.reload.break_minutes).to eq(35)
    expect(va.worked_minutes).to eq(8 * 60 - 35)
  end

  it "ignores an unclosed break rather than guessing a duration" do
    t0 = 8.hours.ago
    event("clock_in",    t0)
    event("break_start", t0 + 4.hours)                 # never ended
    event("clock_out",   t0 + 8.hours)

    expect(va.reload.break_minutes).to eq(0)
    expect(va.worked_minutes).to eq(8 * 60)            # nothing deducted
  end

  it "flows the net figure and the break total onto the timesheet line" do
    t0 = 8.hours.ago
    event("clock_in",    t0)
    event("break_start", t0 + 3.hours); event("break_end", t0 + 3.hours + 30.minutes)
    event("clock_out",   t0 + 8.hours)

    period = Timesheets::BuildPeriod.call(starts_on: va.visit.scheduled_start.to_date.beginning_of_week)
    line = period.timesheet_lines.find_by(visit_assignment_id: va.id)
    expect(line.break_minutes).to eq(30)
    expect(line.worked_minutes).to eq(450)
  end
end
