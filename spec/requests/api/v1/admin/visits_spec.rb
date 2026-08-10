require "rails_helper"

RSpec.describe "Admin visits & scheduling", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }

  it "runs the full flow: service user -> care package -> generate -> publish -> assign" do
    post "/api/v1/admin/service_users",
         params: { first_name: "Ada", last_name: "Smith", lat: 53.48, lng: -2.24, postcode: "M1 1AA" }, headers: auth, as: :json
    expect(response).to have_http_status(:created)
    su_id = response.parsed_body["id"]

    post "/api/v1/admin/care_package_slots",
         params: { service_user_id: su_id, name: "Morning", start_time: "08:00", end_time: "08:45",
                   recurrence: "daily", effective_from: Date.current.iso8601 }, headers: auth, as: :json
    expect(response).to have_http_status(:created)

    # Generate a future window so the visit we publish hasn't already started
    # (publishing a past visit is refused — see the dedicated example below).
    post "/api/v1/admin/visits/generate",
         params: { from: (Date.current + 1).iso8601, to: (Date.current + 3).iso8601 }, headers: auth, as: :json
    expect(response).to have_http_status(:created)
    expect(response.parsed_body["created"]).to eq(3)

    get "/api/v1/admin/visits", params: { from: (Date.current + 1).iso8601, to: (Date.current + 3).iso8601 }, headers: auth
    expect(response.parsed_body.size).to eq(3)
    visit_id = response.parsed_body.first["id"]

    post "/api/v1/admin/visits/#{visit_id}/publish", headers: auth
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["status"]).to eq("published")

    carer = create(:employee)
    post "/api/v1/admin/visit_assignments", params: { visit_id: visit_id, employee_id: carer.id }, headers: auth, as: :json
    expect(response).to have_http_status(:created)
    expect(response.parsed_body["lifecycle_state"]).to eq("scheduled")

    # duplicate active assignment -> 409
    post "/api/v1/admin/visit_assignments", params: { visit_id: visit_id, employee_id: carer.id }, headers: auth, as: :json
    expect(response).to have_http_status(:conflict)
  end

  it "generates nothing on a non-matching recurrence day" do
    su = create(:service_user)
    create(:care_package_slot, service_user: su, recurrence: "sun", effective_from: Date.current)
    # pick a Monday window
    monday = Date.current.next_occurring(:monday)
    post "/api/v1/admin/visits/generate", params: { from: monday.iso8601, to: monday.iso8601 }, headers: auth, as: :json
    expect(response.parsed_body["created"]).to eq(0)
  end

  it "refuses to publish a visit whose start is already in the past (422)" do
    past = create(:visit, service_user: create(:service_user),
                          scheduled_start: 2.hours.ago, scheduled_end: 1.hour.ago, status: :draft)
    post "/api/v1/admin/visits/#{past.id}/publish", headers: auth
    expect(response).to have_http_status(422)
    expect(response.parsed_body["error"]).to eq("visit_in_past")
    expect(past.reload.status).to eq("draft")
  end

  describe "PATCH /admin/visits/:id — retime (audited, honest record protected)" do
    let(:su)    { create(:service_user) }
    let(:visit) { create(:visit, service_user: su, scheduled_start: 1.day.from_now.change(hour: 9), scheduled_end: 1.day.from_now.change(hour: 10)) }

    it "retimes a visit and appends a visit.rescheduled audit event with the reason" do
      new_start = 1.day.from_now.change(hour: 11)
      new_end   = 1.day.from_now.change(hour: 12)
      expect do
        patch "/api/v1/admin/visits/#{visit.id}",
              params: { scheduled_start: new_start.iso8601, scheduled_end: new_end.iso8601, reason: "Client asked for a later call" },
              headers: auth, as: :json
      end.to change { Event.where(aggregate: visit, event_type: "visit.rescheduled").count }.by(1)

      expect(response).to have_http_status(:ok)
      expect(Time.zone.parse(response.parsed_body["scheduled_start"])).to be_within(1.second).of(new_start)
      event = Event.where(aggregate: visit, event_type: "visit.rescheduled").last
      expect(event.actor).to eq(admin)
      expect(event.payload["reason"]).to eq("Client asked for a later call")
      expect(event.payload.dig("from", "scheduled_start")).to be_present
    end

    it "requires a reason (422)" do
      patch "/api/v1/admin/visits/#{visit.id}",
            params: { scheduled_start: 1.day.from_now.change(hour: 11).iso8601 }, headers: auth, as: :json
      expect(response).to have_http_status(422)
      expect(response.parsed_body["error"]).to eq("reason_required")
    end

    it "refuses to retime once a carer has clocked in (protects the original record)" do
      va = create(:visit_assignment, visit: visit, employee: create(:employee))
      va.update!(actual_start: Time.current, lifecycle_state: :in_progress)
      expect do
        patch "/api/v1/admin/visits/#{visit.id}",
              params: { scheduled_start: 1.day.from_now.change(hour: 11).iso8601, reason: "too late" }, headers: auth, as: :json
      end.not_to(change { visit.reload.scheduled_start })
      expect(response).to have_http_status(422)
      expect(response.parsed_body["error"]).to eq("visit_started")
    end
  end
end
