require "rails_helper"

RSpec.describe "Admin monitoring & corrections", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:su)    { create(:service_user, lat: 53.4808, lng: -2.2426) }

  describe "clock corrections" do
    let(:visit) { create(:visit, service_user: su, scheduled_start: 1.hour.ago, scheduled_end: 1.hour.from_now) }
    let(:va)    { create(:visit_assignment, visit: visit, lifecycle_state: "pending_review") }

    it "records a manual admin correction with a reason and resolves the visit" do
      post "/api/v1/admin/clock_corrections",
           params: { visit_assignment_id: va.id, kind: "clock_out", occurred_at: Time.current.iso8601, reason: "carer forgot to clock out" },
           headers: auth, as: :json
      expect(response).to have_http_status(:created)
      expect(va.reload.lifecycle_state).to eq("completed")
      ce = ClockEvent.find_by(visit_assignment: va, method: "manual_admin")
      expect(ce).to be_present
      expect(ce.reason).to eq("carer forgot to clock out")
    end

    it "rejects a correction without a reason (422)" do
      post "/api/v1/admin/clock_corrections",
           params: { visit_assignment_id: va.id, kind: "clock_out", occurred_at: Time.current.iso8601 },
           headers: auth, as: :json
      expect(response).to have_http_status(422)
    end
  end

  describe "alerts" do
    it "lists open alerts and acknowledges one" do
      va = create(:visit_assignment, visit: create(:visit, service_user: su))
      alert = Alerts::Raise.call(subject: va, alert_type: "missed_visit", severity: "high")

      get "/api/v1/admin/alerts", headers: auth
      expect(response.parsed_body.map { |a| a["id"] }).to include(alert.id)

      post "/api/v1/admin/alerts/#{alert.id}/acknowledge", headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["state"]).to eq("acknowledged")
      expect(alert.reload.acknowledged_by).to eq(admin)
    end
  end

  describe "exceptions + live board" do
    it "lists pending-review visits and open alerts" do
      va = create(:visit_assignment, visit: create(:visit, service_user: su), lifecycle_state: "pending_review")
      Alerts::Raise.call(subject: va, alert_type: "geo_anomaly")

      get "/api/v1/admin/exceptions", headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["pending_review"].size).to eq(1)
      expect(response.parsed_body["open_alerts"].size).to eq(1)
    end

    it "shows today's assignments with counts" do
      create(:visit_assignment, visit: create(:visit, service_user: su, scheduled_start: Time.current.change(hour: 12), scheduled_end: Time.current.change(hour: 13)), lifecycle_state: "scheduled")

      get "/api/v1/admin/live_board", headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["counts"]["scheduled"]).to eq(1)
      expect(response.parsed_body["assignments"].size).to eq(1)
    end
  end
end
