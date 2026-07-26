require "rails_helper"

RSpec.describe "Staff offline sync", type: :request do
  let(:employee)     { create(:employee) }
  let(:service_user) { create(:service_user, lat: 53.4808, lng: -2.2426) }
  let(:visit)        { create(:visit, service_user: service_user) }
  let!(:va)          { create(:visit_assignment, visit: visit, employee: employee) }
  let(:auth)         { { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" } }

  def event(cid:, lat:, lng:, kind: "clock_in")
    { visit_assignment_id: va.id, kind: kind, client_event_id: cid, occurred_at: Time.current.iso8601, lat: lat, lng: lng }
  end

  it "ingests an offline batch idempotently" do
    cid = SecureRandom.uuid
    batch = { events: [ event(cid: cid, lat: 53.4808, lng: -2.2426) ] }

    post "/api/v1/staff/sync/events", params: batch, headers: auth, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.dig("results", 0, "status")).to eq("ok")
    expect(ClockEvent.count).to eq(1)

    post "/api/v1/staff/sync/events", params: batch, headers: auth, as: :json
    expect(response.parsed_body.dig("results", 0, "status")).to eq("replay")
    expect(ClockEvent.count).to eq(1)
  end

  it "records an offline out-of-range clock-in as flagged, not dropped" do
    post "/api/v1/staff/sync/events",
         params: { events: [ event(cid: SecureRandom.uuid, lat: 53.9, lng: -2.9) ] }, headers: auth, as: :json
    expect(response.parsed_body.dig("results", 0, "status")).to eq("ok")     # recorded
    expect(response.parsed_body.dig("results", 0, "geofence")).to eq("fail")
    expect(va.reload.lifecycle_state).to eq("pending_review")
  end

  it "returns the carer's visits + service-user coords to cache" do
    get "/api/v1/staff/sync/changes", headers: auth
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body["visits"].size).to eq(1)
    expect(body.dig("visits", 0, "visit", "service_user", "lat")).to eq(53.4808)
    expect(body["cursor"]).to be_present
  end
end
