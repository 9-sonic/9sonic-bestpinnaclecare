require "rails_helper"

# The patient-centric record surface: a client's visits (who attended, when),
# and a single visit as a complete record (clock history + notes + care plan).
RSpec.describe "Admin service-user visits & visit detail", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:su)    { create(:service_user, lat: 53.4808, lng: -2.2426) }
  let(:alice) { create(:employee, first_name: "Alice", last_name: "Attend") }
  let(:bob)   { create(:employee, first_name: "Bob", last_name: "Cover") }

  def visit_on(start:, carer: alice)
    v  = create(:visit, service_user: su, scheduled_start: start, scheduled_end: start + 45.minutes)
    create(:visit_assignment, visit: v, employee: carer)
    v
  end

  describe "GET /admin/service_users/:id/visits — who attended this patient, when" do
    it "lists the client's visits newest-first with the attending carer" do
      visit_on(start: 2.days.ago, carer: alice)
      visit_on(start: 1.day.ago, carer: bob)

      get "/api/v1/admin/service_users/#{su.id}/visits", headers: auth
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["total"]).to eq(2)
      # Newest first, and each row names who attended.
      expect(body["items"].first["carers"].first["employee_name"]).to eq("Bob Cover")
      expect(body["items"].last["carers"].first["employee_name"]).to eq("Alice Attend")
    end

    it "filters to visits a specific carer attended" do
      visit_on(start: 2.days.ago, carer: alice)
      visit_on(start: 1.day.ago, carer: bob)

      get "/api/v1/admin/service_users/#{su.id}/visits", params: { employee_id: alice.id }, headers: auth
      body = response.parsed_body
      expect(body["total"]).to eq(1)
      expect(body["items"].first["carers"].first["employee_name"]).to eq("Alice Attend")
    end

    it "reaches a visit from over a year ago via the date range" do
      old = visit_on(start: 400.days.ago)
      visit_on(start: 1.day.ago)

      get "/api/v1/admin/service_users/#{su.id}/visits",
          params: { from: 410.days.ago.to_date.iso8601, to: 390.days.ago.to_date.iso8601 }, headers: auth
      body = response.parsed_body
      expect(body["total"]).to eq(1)
      expect(body["items"].first["id"]).to eq(old.id)
    end

    it "does not 500 on a garbage date" do
      visit_on(start: 1.day.ago)
      get "/api/v1/admin/service_users/#{su.id}/visits", params: { from: "nonsense" }, headers: auth
      expect(response).to have_http_status(:ok)
    end
  end

  describe "GET /admin/visits/:id — one visit as a full record" do
    it "returns clock history, notes and the care plan for the visit" do
      v  = create(:visit, service_user: su, scheduled_start: 90.minutes.ago, scheduled_end: 30.minutes.ago)
      va = create(:visit_assignment, visit: v, employee: alice)
      su.care_plan_items.create!(label: "Morning meds", category: "medication")
      VisitNote.create!(visit_assignment: va, author: alice, body: "All well", client_note_id: SecureRandom.uuid)
      Clocking::RecordClockEvent.call(
        visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
        occurred_at: 85.minutes.ago, lat: 53.4808, lng: -2.2426, actor: alice
      )

      get "/api/v1/admin/visits/#{v.id}", headers: auth
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      assignment = body["assignments"].find { |a| a["employee"]&.fetch("id") == alice.id }
      expect(assignment["notes"].first["body"]).to eq("All well")
      expect(assignment["clock_events"].first["kind"]).to eq("clock_in")
      expect(body["care_plan"].map { |c| c["label"] }).to include("Morning meds")
    end
  end
end
