require "rails_helper"

RSpec.describe "Staff PWA endpoints", type: :request do
  let(:employee) { create(:employee, contracted_hours_per_week: 37.5, hourly_rate_pence: 1250) }
  let(:auth)     { { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" } }
  let(:su)       { create(:service_user, lat: 53.4808, lng: -2.2426) }

  describe "profile (me)" do
    it "shows private fields + pay and edits the profile" do
      get "/api/v1/staff/me", headers: auth
      expect(response.parsed_body).to include("contracted_hours_per_week" => 37.5, "hourly_rate_pence" => 1250)
      expect(response.parsed_body).to have_key("emergency_contact_name")

      patch "/api/v1/staff/me", params: { first_name: "Renamed", emergency_contact_phone: "07700 900123" }, headers: auth, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["first_name"]).to eq("Renamed")
      expect(response.parsed_body["emergency_contact_phone"]).to eq("07700 900123")
    end
  end

  describe "availability" do
    it "saves and reads a weekly pattern" do
      put "/api/v1/staff/availability",
          params: { entries: [ { weekday: 0, slot: "morning", available: true }, { weekday: 0, slot: "night", available: false } ] },
          headers: auth, as: :json
      expect(response).to have_http_status(:ok)
      get "/api/v1/staff/availability", headers: auth
      expect(response.parsed_body.size).to eq(2)
      expect(response.parsed_body.find { |a| a["slot"] == "night" }["available"]).to be(false)
    end
  end

  describe "visit detail: care plan, tasks, notes" do
    let(:va) { create(:visit_assignment, employee: employee, visit: create(:visit, service_user: su)) }

    before do
      su.care_plan_items.create!(category: "medication", label: "8am tablets", position: 0)
      su.care_plan_items.create!(category: "mobility", label: "Help to chair", position: 1)
    end

    it "returns the assignment with care plan + seeded tasks + notes, and records a note" do
      get "/api/v1/staff/visit_assignments/#{va.id}", headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["care_plan"].size).to eq(2)
      expect(response.parsed_body["tasks"].size).to eq(2)  # seeded from care plan

      task_id = response.parsed_body["tasks"].first["id"]
      patch "/api/v1/staff/visit_assignments/#{va.id}/tasks", params: { tasks: [ { id: task_id, done: true } ] }, headers: auth, as: :json
      expect(response.parsed_body.find { |t| t["id"] == task_id }["done"]).to be(true)

      cid = SecureRandom.uuid
      post "/api/v1/staff/visit_assignments/#{va.id}/note", params: { body: "All well, ate lunch.", client_note_id: cid }, headers: auth, as: :json
      expect(response).to have_http_status(:created)
      # idempotent replay
      expect {
        post "/api/v1/staff/visit_assignments/#{va.id}/note", params: { body: "All well, ate lunch.", client_note_id: cid }, headers: auth, as: :json
      }.not_to change(VisitNote, :count)
    end

    it "won't return another carer's visit" do
      other = create(:employee)
      get "/api/v1/staff/visit_assignments/#{va.id}", headers: { "Authorization" => "Bearer #{jwt_for(other, :employee)}" }
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "breaks" do
    let(:va) { create(:visit_assignment, employee: employee, visit: create(:visit, service_user: su, scheduled_start: 20.minutes.ago, scheduled_end: 1.hour.from_now), lifecycle_state: "in_progress") }

    it "records a break without changing the lifecycle" do
      post "/api/v1/staff/visit_assignments/#{va.id}/break",
           params: { phase: "start", client_event_id: SecureRandom.uuid, occurred_at: Time.current.iso8601 }, headers: auth, as: :json
      expect(response).to have_http_status(:created)
      expect(ClockEvent.where(visit_assignment: va, kind: "break_start")).to exist
      expect(va.reload.lifecycle_state).to eq("in_progress")
    end
  end

  describe "mileage" do
    it "creates and lists mileage claims" do
      post "/api/v1/staff/mileage", params: { travel_date: Date.current.iso8601, miles: 4.2, from_label: "Ada's", to_label: "Bert's" }, headers: auth, as: :json
      expect(response).to have_http_status(:created)
      get "/api/v1/staff/mileage", headers: auth
      expect(response.parsed_body.first["miles"]).to eq(4.2)
    end
  end

  describe "devices" do
    it "registers a device and revokes it" do
      fp = SecureRandom.uuid
      post "/api/v1/staff/devices", params: { fingerprint: fp, platform: "iOS", push_subscription: { endpoint: "https://push", keys: { p256dh: "x", auth: "y" } } }, headers: auth, as: :json
      expect(response).to have_http_status(:created)
      expect(employee.devices.find_by(fingerprint: fp).push_subscription["endpoint"]).to eq("https://push")
      delete "/api/v1/staff/devices/#{fp}", headers: auth
      expect(response).to have_http_status(:no_content)
      expect(employee.devices.find_by(fingerprint: fp).revoked_at).to be_present
    end
  end

  describe "passkey management" do
    it "lists and revokes credentials" do
      cred = employee.webauthn_credentials.create!(external_id: "abc", public_key: "pk", sign_count: 0, nickname: "iPhone")
      get "/api/v1/staff/webauthn/credentials", headers: auth
      expect(response.parsed_body.first["nickname"]).to eq("iPhone")
      delete "/api/v1/staff/webauthn/credentials/#{cred.id}", headers: auth
      expect(response).to have_http_status(:no_content)
      expect(employee.webauthn_credentials.count).to eq(0)
    end
  end

  describe "summary + timesheet periods" do
    it "returns headline totals" do
      get "/api/v1/staff/summary", headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to include("hours_worked_minutes", "visits_count", "miles")
      expect(response.parsed_body["contracted_minutes"]).to eq(2250) # 37.5h
      expect(response.parsed_body["by_weekday"]["visits"].size).to eq(7)
    end
  end
end
