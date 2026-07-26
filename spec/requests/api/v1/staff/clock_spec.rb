require "rails_helper"

RSpec.describe "Staff clock-in/out (geofenced)", type: :request do
  let(:employee)     { create(:employee) }
  let(:service_user) { create(:service_user, lat: 53.4808, lng: -2.2426, geofence_radius_m: 150) }
  let(:visit)        { create(:visit, service_user: service_user, scheduled_start: 10.minutes.from_now, scheduled_end: 1.hour.from_now) }
  let(:va)           { create(:visit_assignment, visit: visit, employee: employee) }
  let(:auth)         { { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" } }

  def clock(kind:, lat:, lng:, occurred_at: Time.current, cid: SecureRandom.uuid)
    post "/api/v1/staff/visit_assignments/#{va.id}/clock",
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

  it "allows clock-in with no GPS fix but routes to review + raises an alert" do
    clock(kind: "clock_in", lat: nil, lng: nil)
    expect(response).to have_http_status(:created)
    expect(response.parsed_body["geofence"]).to eq("no_fix")
    expect(va.reload.lifecycle_state).to eq("pending_review")
    expect(Alert.where(subject: va, alert_type: "geo_anomaly", state: "open")).to exist
  end

  it "is idempotent on client_event_id (replay -> 200, single event)" do
    cid = SecureRandom.uuid
    clock(kind: "clock_in", lat: 53.4808, lng: -2.2426, cid: cid)
    expect(response).to have_http_status(:created)
    expect { clock(kind: "clock_in", lat: 53.4808, lng: -2.2426, cid: cid) }.not_to change(ClockEvent, :count)
    expect(response).to have_http_status(:ok)
  end

  it "records worked minutes on clock-out" do
    clock(kind: "clock_in",  lat: 53.4808, lng: -2.2426, occurred_at: 8.minutes.ago)
    clock(kind: "clock_out", lat: 53.4808, lng: -2.2426, occurred_at: Time.current)
    expect(response).to have_http_status(:created)
    expect(va.reload.lifecycle_state).to eq("completed")
    expect(va.worked_minutes).to eq(8)
  end

  it "won't let a carer clock someone else's visit" do
    other = create(:employee)
    post "/api/v1/staff/visit_assignments/#{va.id}/clock",
         params: { kind: "clock_in", client_event_id: SecureRandom.uuid, occurred_at: Time.current.iso8601, lat: 53.4808, lng: -2.2426 },
         headers: { "Authorization" => "Bearer #{jwt_for(other, :employee)}" }, as: :json
    expect(response).to have_http_status(:not_found)
  end
end
