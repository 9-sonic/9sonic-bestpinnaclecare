require "rails_helper"

RSpec.describe "Endpoint coverage gaps", type: :request do
  let(:su) { create(:service_user, lat: 53.4808, lng: -2.2426) }

  describe "admin timesheet lock" do
    it "locks a period" do
      mgr  = create(:admin, role: :manager)
      auth = { "Authorization" => "Bearer #{jwt_for(mgr, :admin)}" }
      week = Date.current.beginning_of_week
      create(:visit_assignment, employee: create(:employee), lifecycle_state: "completed", worked_minutes: 30,
             visit: create(:visit, service_user: su, scheduled_start: week.to_time + 8.hours, scheduled_end: week.to_time + 9.hours))

      post "/api/v1/admin/timesheet_periods", params: { starts_on: week.iso8601 }, headers: auth, as: :json
      pid = response.parsed_body["id"]
      post "/api/v1/admin/timesheet_periods/#{pid}/lock", headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["status"]).to eq("locked")
    end
  end

  describe "admin alerts resolve + assignment withdraw" do
    let(:rm)   { create(:admin, role: :registered_manager) }
    let(:auth) { { "Authorization" => "Bearer #{jwt_for(rm, :admin)}" } }

    it "resolves an open alert" do
      alert = Alerts::Raise.call(subject: create(:visit_assignment, visit: create(:visit, service_user: su)), alert_type: "missed_visit")
      post "/api/v1/admin/alerts/#{alert.id}/resolve", params: { resolution_note: "handled" }, headers: auth, as: :json
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["state"]).to eq("resolved")
    end

    it "withdraws an assignment (manual reassignment path)" do
      va = create(:visit_assignment, visit: create(:visit, service_user: su))
      delete "/api/v1/admin/visit_assignments/#{va.id}", headers: auth
      expect(response).to have_http_status(:no_content)
      expect(va.reload.assignment_status).to eq("withdrawn")
      expect(va.lifecycle_state).to eq("cancelled")
    end
  end

  describe "staff mileage + timesheet_periods index" do
    let(:emp)  { create(:employee) }
    let(:auth) { { "Authorization" => "Bearer #{jwt_for(emp, :employee)}" } }

    it "lists the carer's mileage" do
      emp.mileage_claims.create!(travel_date: Date.current, miles: 5, source: "carer", state: "claimed")
      get "/api/v1/staff/mileage", headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.first["miles"]).to eq(5.0)
    end

    it "lists the periods the carer has lines in" do
      period = TimesheetPeriod.create!(starts_on: Date.current.beginning_of_week, ends_on: Date.current.end_of_week)
      va = create(:visit_assignment, employee: emp, visit: create(:visit, service_user: su))
      period.timesheet_lines.create!(employee: emp, visit_assignment: va, work_date: Date.current, scheduled_minutes: 45, worked_minutes: 45)

      get "/api/v1/staff/timesheet_periods", headers: auth
      expect(response.parsed_body.map { |p| p["id"] }).to include(period.id)
    end
  end

  describe "chat messages before-cursor" do
    it "filters messages by the before timestamp" do
      admin = create(:admin)
      emp   = create(:employee)
      convo = Messaging::CreateConversation.direct(creator: admin, other: emp)
      Messaging::SendMessage.call(conversation: convo, sender: admin, body: "hello", client_message_id: SecureRandom.uuid)

      get "/api/v1/conversations/#{convo.id}/messages", params: { before: 1.hour.from_now.iso8601 },
          headers: { "Authorization" => "Bearer #{jwt_for(emp, :employee)}" }
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body.map { |m| m["body"] }).to include("hello")

      # nothing before an hour ago
      get "/api/v1/conversations/#{convo.id}/messages", params: { before: 1.hour.ago.iso8601 },
          headers: { "Authorization" => "Bearer #{jwt_for(emp, :employee)}" }
      expect(response.parsed_body).to be_empty
    end
  end
end
