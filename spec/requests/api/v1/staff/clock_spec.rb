require "rails_helper"

RSpec.describe "Staff clock-in/out (geofenced)", type: :request do
  let(:employee)     { create(:employee) }
  let(:service_user) { create(:service_user, lat: 53.4808, lng: -2.2426, geofence_radius_m: 150) }
  let(:visit)        { create(:visit, service_user: service_user, scheduled_start: 10.minutes.from_now, scheduled_end: 1.hour.from_now) }
  let(:va)           { create(:visit_assignment, visit: visit, employee: employee) }
  let(:auth)         { { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" } }

  def clock(kind:, lat:, lng:, occurred_at: Time.current, cid: SecureRandom.uuid, assignment: va)
    post "/api/v1/staff/visit_assignments/#{assignment.id}/clock",
         params: { kind: kind, client_event_id: cid, occurred_at: occurred_at.iso8601, lat: lat, lng: lng, accuracy_m: 5 },
         headers: auth, as: :json
  end

  it "clocks in inside the geofence -> pass + in_progress" do
    clock(kind: "clock_in", lat: 53.4808, lng: -2.2426)
    expect(response).to have_http_status(:created)
    expect(response.parsed_body["geofence"]).to eq("pass")
    expect(response.parsed_body["lifecycle_state"]).to eq("in_progress")
    expect(va.reload.lifecycle_state).to eq("in_progress")
  end

  it "blocks clock-in outside the geofence (422 too_far, no event written)" do
    expect { clock(kind: "clock_in", lat: 53.6, lng: -2.6) }.not_to change(ClockEvent, :count)
    expect(response).to have_http_status(422)
    expect(response.parsed_body["error"]).to eq("too_far")
    expect(response.parsed_body["distance_m"]).to be > 150
  end

  it "rejects a live clock-in with no GPS fix in block mode (422 location_required, no event)" do
    # Otherwise the geofence is bypassable by clocking in with location off.
    expect { clock(kind: "clock_in", lat: nil, lng: nil) }.not_to change(ClockEvent, :count)
    expect(response).to have_http_status(422)
    expect(response.parsed_body["error"]).to eq("location_required")
    expect(va.reload.lifecycle_state).to eq("scheduled")
  end

  it "rejects clocking in before the check-in window opens (422 too_early, no event)" do
    future = create(:visit, service_user: service_user, scheduled_start: 3.hours.from_now, scheduled_end: 4.hours.from_now)
    fva    = create(:visit_assignment, visit: future, employee: employee)

    expect do
      post "/api/v1/staff/visit_assignments/#{fva.id}/clock",
           params: { kind: "clock_in", client_event_id: SecureRandom.uuid, occurred_at: Time.current.iso8601,
                     lat: 53.4808, lng: -2.2426, accuracy_m: 5 }, # on-site: proves it's the time gate, not geofence
           headers: auth, as: :json
    end.not_to change(ClockEvent, :count)

    expect(response).to have_http_status(422)
    expect(response.parsed_body["error"]).to eq("too_early")
    expect(fva.reload.lifecycle_state).to eq("scheduled")
  end

  it "is idempotent on client_event_id (replay -> 200, single event)" do
    cid = SecureRandom.uuid
    clock(kind: "clock_in", lat: 53.4808, lng: -2.2426, cid: cid)
    expect(response).to have_http_status(:created)
    expect { clock(kind: "clock_in", lat: 53.4808, lng: -2.2426, cid: cid) }.not_to change(ClockEvent, :count)
    expect(response).to have_http_status(:ok)
  end

  it "records worked minutes on clock-out" do
    # A visit under way whose scheduled end is ~now, so clocking out now is on
    # time (not flagged as an early leave) and the visit completes.
    started = create(:visit, service_user: service_user, scheduled_start: 20.minutes.ago, scheduled_end: 2.minutes.from_now)
    sva     = create(:visit_assignment, visit: started, employee: employee)
    clock(kind: "clock_in",  lat: 53.4808, lng: -2.2426, occurred_at: 8.minutes.ago, assignment: sva)
    clock(kind: "clock_out", lat: 53.4808, lng: -2.2426, occurred_at: Time.current, assignment: sva)
    expect(response).to have_http_status(:created)
    expect(sva.reload.lifecycle_state).to eq("completed")
    expect(sva.worked_minutes).to eq(8)
  end

  it "won't let a carer clock someone else's visit" do
    other = create(:employee)
    post "/api/v1/staff/visit_assignments/#{va.id}/clock",
         params: { kind: "clock_in", client_event_id: SecureRandom.uuid, occurred_at: Time.current.iso8601, lat: 53.4808, lng: -2.2426 },
         headers: { "Authorization" => "Bearer #{jwt_for(other, :employee)}" }, as: :json
    expect(response).to have_http_status(:not_found)
  end
end
