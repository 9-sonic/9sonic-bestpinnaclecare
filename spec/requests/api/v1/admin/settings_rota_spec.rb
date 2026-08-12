require "rails_helper"

RSpec.describe "Admin settings, validators, rota copy & dashboard", type: :request do
  let(:manager) { create(:admin, role: :manager) }
  let(:auth)    { { "Authorization" => "Bearer #{jwt_for(manager, :admin)}" } }
  let(:su)      { create(:service_user, lat: 53.4808, lng: -2.2426) }

  describe "settings" do
    it "shows and updates provider config" do
      get "/api/v1/admin/settings", headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["geofence_radius_m"]).to eq(150)

      patch "/api/v1/admin/settings", params: { geofence_radius_m: 200, missed_threshold_minutes: 25 }, headers: auth, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["geofence_radius_m"]).to eq(200)
    end

    it "forbids a coordinator from updating settings" do
      coord = create(:admin, role: :coordinator)
      patch "/api/v1/admin/settings", params: { geofence_radius_m: 999 },
            headers: { "Authorization" => "Bearer #{jwt_for(coord, :admin)}" }, as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "assignment validators" do
    it "hard-blocks an overlapping (double-booked) carer with 422 carer_unavailable" do
      carer = create(:employee)
      v1 = create(:visit, service_user: su, scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now)
      create(:visit_assignment, visit: v1, employee: carer)
      v2 = create(:visit, service_user: su, scheduled_start: 2.hours.from_now + 30.minutes, scheduled_end: 4.hours.from_now)

      post "/api/v1/admin/visit_assignments", params: { visit_id: v2.id, employee_id: carer.id }, headers: auth, as: :json
      expect(response).to have_http_status(:unprocessable_entity)
      expect(response.parsed_body["error"]).to eq("carer_unavailable")
      expect(VisitAssignment.where(visit: v2, assignment_status: "assigned")).not_to exist
    end

    it "returns non-blocking rest/weekly warnings when there is no time overlap" do
      carer = create(:employee)
      v1 = create(:visit, service_user: su, scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now)
      create(:visit_assignment, visit: v1, employee: carer)
      # Starts after v1 ends (no overlap) but within 11h -> rest_period warning only.
      v2 = create(:visit, service_user: su, scheduled_start: 3.hours.from_now, scheduled_end: 4.hours.from_now)

      post "/api/v1/admin/visit_assignments", params: { visit_id: v2.id, employee_id: carer.id }, headers: auth, as: :json
      expect(response).to have_http_status(:created)
      expect(response.parsed_body["warnings"].map { |w| w["code"] }).to include("rest_period")
    end
  end

  describe "rota copy-week" do
    it "copies a week's visits into the next week" do
      wk = Date.current.beginning_of_week
      create(:visit, service_user: su, scheduled_start: wk.to_time + 8.hours, scheduled_end: wk.to_time + 9.hours)

      post "/api/v1/admin/rota_copies",
           params: { from_week_start: wk.iso8601, to_week_start: (wk + 7).iso8601 }, headers: auth, as: :json
      expect(response).to have_http_status(:created)
      expect(response.parsed_body["created"]).to eq(1)
    end
  end

  describe "dashboard" do
    it "returns headline counts" do
      create(:visit_assignment, visit: create(:visit, service_user: su, scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now))
      get "/api/v1/admin/dashboard", headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to have_key("today_counts")
      expect(response.parsed_body).to have_key("unassigned_upcoming")
    end
  end
end
