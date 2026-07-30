require "rails_helper"

# §13: a 23:00–07:00 visit is 7h in March (spring forward) and 9h in October
# (fall back), and hours are attributed to the shift START date.
RSpec.describe "DST boundary handling", type: :model do
  let(:su) { create(:service_user) }

  def overnight_visit_on(date)
    create(:care_package_slot, service_user: su, start_time: "23:00", end_time: "07:00",
           recurrence: "daily", effective_from: date - 1)
    Visits::GenerateFromCarePackages.call(from: date, to: date)
    su.visits.order(:id).last
  end

  it "is 7 hours across the spring-forward night" do
    v = overnight_visit_on(Date.new(2026, 3, 28)) # clocks go forward 29 Mar 01:00
    expect(((v.scheduled_end - v.scheduled_start) / 3600.0).round).to eq(7)
    expect(v.scheduled_start.to_date).to eq(Date.new(2026, 3, 28))
  end

  it "is 9 hours across the autumn fall-back night" do
    v = overnight_visit_on(Date.new(2026, 10, 24)) # clocks go back 25 Oct 02:00
    expect(((v.scheduled_end - v.scheduled_start) / 3600.0).round).to eq(9)
  end

  it "attributes the visit to its START date on the timesheet" do
    v  = overnight_visit_on(Date.new(2026, 3, 28))
    va = create(:visit_assignment, visit: v, employee: create(:employee), lifecycle_state: "completed", worked_minutes: 420)
    period = Timesheets::BuildPeriod.call(starts_on: Date.new(2026, 3, 23)) # week containing 28 Mar
    line = period.timesheet_lines.find_by(visit_assignment: va)
    expect(line.work_date).to eq(Date.new(2026, 3, 28))
    expect(line.scheduled_minutes).to eq(420) # 7h
  end
end
