require "rails_helper"

RSpec.describe "Clock correction chain", type: :model do
  let(:su)    { create(:service_user, lat: 53.4808, lng: -2.2426) }
  # A visit already in its check-in window, so clock-ins here exercise the
  # correction/skew logic rather than being refused as too-early.
  let(:va)    { create(:visit_assignment, visit: create(:visit, service_user: su, scheduled_start: 30.minutes.ago, scheduled_end: 90.minutes.from_now), employee: create(:employee)) }
  let(:admin) { create(:admin) }

  def clock(actor:, occurred_at:, corrects_id: nil, method: "gps", reason: nil)
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid, occurred_at: occurred_at,
      lat: 53.4808, lng: -2.2426, actor: actor, method: method, reason: reason, corrects_id: corrects_id
    ).clock_event
  end

  it "resolves the effective clock-in to the latest correction; superseded stays visible" do
    original   = clock(actor: va.employee, occurred_at: Time.current)
    correction = clock(actor: admin, occurred_at: 5.minutes.ago, method: "manual_admin", reason: "wrong time", corrects_id: original.id)

    expect(va.effective_clock_in.id).to eq(correction.id)
    expect(ClockEvent.exists?(original.id)).to be(true)                 # original never deleted
    expect(ClockEvent.effective.pluck(:id)).not_to include(original.id) # but excluded from effective

    # correcting the correction resolves forward again
    correction2 = clock(actor: admin, occurred_at: 3.minutes.ago, method: "manual_admin", reason: "again", corrects_id: correction.id)
    expect(va.reload.effective_clock_in.id).to eq(correction2.id)
  end

  it "routes a device clock that is well outside skew tolerance to pending_review (not rejected)" do
    res = Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: 30.minutes.from_now, lat: 53.4808, lng: -2.2426, actor: va.employee
    )
    expect(res.status).to eq(:ok)
    expect(res.geofence_result).to eq("pass")
    expect(va.reload.lifecycle_state).to eq("pending_review")
  end

  it "is append-only — a clock event cannot be updated or destroyed" do
    ce = clock(actor: va.employee, occurred_at: Time.current)
    expect { ce.update!(reason: "x") }.to raise_error(ActiveRecord::ReadOnlyRecord)
    expect { ce.destroy }.to raise_error(ActiveRecord::ReadOnlyRecord)
  end
end
