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
    expect(response.parsed_body["items"].size).to eq(3)
    visit_id = response.parsed_body["items"].first["id"]

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

  it "refuses to CREATE a visit whose start is in the past (422)" do
    su = create(:service_user)
    expect {
      post "/api/v1/admin/visits",
           params: { service_user_id: su.id, scheduled_start: 2.hours.ago.iso8601, scheduled_end: 1.hour.ago.iso8601 },
           headers: auth, as: :json
    }.not_to change(Visit, :count)
    expect(response).to have_http_status(422)
    expect(response.parsed_body["error"]).to eq("visit_in_past")
  end

  it "allows creating a future visit" do
    su = create(:service_user)
    post "/api/v1/admin/visits",
         params: { service_user_id: su.id, scheduled_start: 2.hours.from_now.iso8601, scheduled_end: 3.hours.from_now.iso8601 },
         headers: auth, as: :json
    expect(response).to have_http_status(:created)
  end

  it "refuses a second visit for the same client that overlaps in time (422 client_overlap)" do
    su = create(:service_user)
    create(:visit, service_user: su, scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now)
    expect {
      post "/api/v1/admin/visits",
           params: { service_user_id: su.id, scheduled_start: (2.hours.from_now + 30.minutes).iso8601, scheduled_end: 4.hours.from_now.iso8601 },
           headers: auth, as: :json
    }.not_to change(Visit, :count)
    expect(response).to have_http_status(422)
    expect(response.parsed_body["error"]).to eq("client_overlap")
  end

  it "allows a second visit for the same client that does NOT overlap" do
    su = create(:service_user)
    create(:visit, service_user: su, scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now)
    post "/api/v1/admin/visits",
         params: { service_user_id: su.id, scheduled_start: 4.hours.from_now.iso8601, scheduled_end: 5.hours.from_now.iso8601 },
         headers: auth, as: :json
    expect(response).to have_http_status(:created)
  end

  describe "POST /admin/visits/:id/cancel — cancel + free the carer" do
    let(:su)    { create(:service_user) }
    let(:visit) { create(:visit, service_user: su, scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now, status: :published) }
    let!(:va)   { create(:visit_assignment, visit: visit, employee: create(:employee)) }

    it "cancels the visit and withdraws (frees) the carer" do
      post "/api/v1/admin/visits/#{visit.id}/cancel", params: { reason: "client in hospital" }, headers: auth, as: :json
      expect(response).to have_http_status(:ok)
      expect(visit.reload.status).to eq("cancelled")
      expect(visit.cancellation_reason).to eq("client in hospital")
      expect(va.reload.assignment_status).to eq("withdrawn") # carer freed
    end

    it "requires a reason" do
      post "/api/v1/admin/visits/#{visit.id}/cancel", params: {}, headers: auth, as: :json
      expect(response).to have_http_status(422)
      expect(response.parsed_body["error"]).to eq("reason_required")
    end

    it "refuses to cancel once a carer has clocked in (honest record protected)" do
      va.update!(actual_start: 1.minute.ago, lifecycle_state: :in_progress)
      post "/api/v1/admin/visits/#{visit.id}/cancel", params: { reason: "x" }, headers: auth, as: :json
      expect(response).to have_http_status(422)
      expect(response.parsed_body["error"]).to eq("visit_started")
      expect(visit.reload.status).not_to eq("cancelled")
    end
  end

  describe "DELETE /admin/visits/:id — hard-delete a visit with no clock history" do
    let(:su)    { create(:service_user) }
    let(:visit) { create(:visit, service_user: su, scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now, status: :draft) }
    let!(:va)   { create(:visit_assignment, visit: visit, employee: create(:employee)) }

    it "deletes the visit and its assignment (freeing the carer), and audits it" do
      expect do
        delete "/api/v1/admin/visits/#{visit.id}", headers: auth
      end.to change(Visit, :count).by(-1).and change(VisitAssignment, :count).by(-1)
      expect(response).to have_http_status(:no_content)
      expect(Event.where(event_type: "visit.deleted", aggregate_id: visit.id).count).to eq(1)
    end

    it "refuses to delete once a carer has clocked in (use cancel; record is kept)" do
      va.update!(actual_start: 1.minute.ago, lifecycle_state: :in_progress)
      expect do
        delete "/api/v1/admin/visits/#{visit.id}", headers: auth
      end.not_to change(Visit, :count)
      expect(response).to have_http_status(422)
      expect(response.parsed_body["error"]).to eq("visit_started")
    end

    it "refuses (backstop) when an assignment holds a clock event but no actual_start" do
      # A held clock record with actual_start NOT set on the assignment — proves the
      # DB restrict (dependent: :restrict_with_error), not just the actual_start guard,
      # protects the record.
      ClockEvent.create!(visit_assignment: va, kind: "clock_in", occurred_at: Time.current,
                         client_event_id: SecureRandom.uuid, created_by: va.employee)
      expect do
        delete "/api/v1/admin/visits/#{visit.id}", headers: auth
      end.not_to change(Visit, :count)
      expect(response).to have_http_status(422)
      expect(response.parsed_body["error"]).to eq("visit_has_records")
    end
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

    it "allows retiming a visit once a carer has clocked in, and still audits it (admin reconciliation)" do
      va = create(:visit_assignment, visit: visit, employee: create(:employee))
      va.update!(actual_start: Time.current, lifecycle_state: :in_progress)
      new_start = 1.day.from_now.change(hour: 11)
      new_end   = 1.day.from_now.change(hour: 12)
      expect do
        patch "/api/v1/admin/visits/#{visit.id}",
              params: { scheduled_start: new_start.iso8601, scheduled_end: new_end.iso8601, reason: "too late" }, headers: auth, as: :json
      end.to change { Event.where(aggregate: visit, event_type: "visit.rescheduled").count }.by(1)
      expect(response).to have_http_status(:ok)
      expect(Time.zone.parse(visit.reload.scheduled_start.to_s)).to be_within(1.second).of(new_start)
    end

    it "allows retiming a visit that is already in the past" do
      past = create(:visit, service_user: su, scheduled_start: 2.hours.ago, scheduled_end: 1.hour.ago)
      new_start = 1.day.from_now.change(hour: 11)
      new_end   = 1.day.from_now.change(hour: 12)
      patch "/api/v1/admin/visits/#{past.id}",
            params: { scheduled_start: new_start.iso8601, scheduled_end: new_end.iso8601, reason: "reconciling last week's rota" },
            headers: auth, as: :json
      expect(response).to have_http_status(:ok)
      expect(Time.zone.parse(past.reload.scheduled_start.to_s)).to be_within(1.second).of(new_start)
    end
  end

  # The two read/write paths the rebuilt rota console added a caller for. Both
  # existed server-side with no consumer, so the shapes below are what the
  # office UI actually reads — assert them, not just the status code.
  describe "GET /admin/visits/:id/events — the visit's audit trail" do
    let(:su)       { create(:service_user) }
    let(:employee) { create(:employee) }
    let(:visit)    { create(:visit, service_user: su, scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now, status: :published) }

    it "merges visit-level and assignment-level events, oldest first, with the actor resolved" do
      post "/api/v1/admin/visit_assignments",
           params: { visit_id: visit.id, employee_id: employee.id }, headers: auth, as: :json
      expect(response).to have_http_status(:created)

      patch "/api/v1/admin/visits/#{visit.id}",
            params: { scheduled_start: 4.hours.from_now.iso8601, scheduled_end: 5.hours.from_now.iso8601,
                      reason: "client asked for a later call" }, headers: auth, as: :json
      expect(response).to have_http_status(:ok)

      get "/api/v1/admin/visits/#{visit.id}/events", headers: auth
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body).to be_an(Array)

      types = body.map { |e| e["event_type"] }
      # An assignment event (recorded against the VisitAssignment) and a visit
      # event (recorded against the Visit) both surface in the one timeline.
      expect(types).to include("assignment.created", "visit.rescheduled")
      expect(body.map { |e| e["occurred_at"] }).to eq(body.map { |e| e["occurred_at"] }.sort)

      # Fields the drawer's History list renders.
      reschedule = body.find { |e| e["event_type"] == "visit.rescheduled" }
      expect(reschedule["actor_name"]).to eq(admin.full_name)
      expect(reschedule["occurred_at"]).to be_present
      expect(reschedule.dig("payload", "reason")).to eq("client asked for a later call")

      assigned = body.find { |e| e["event_type"] == "assignment.created" }
      expect(assigned.dig("payload", "employee_name")).to eq(employee.full_name)
    end

    it "returns an empty array for a visit with no history" do
      get "/api/v1/admin/visits/#{visit.id}/events", headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).to eq([])
    end
  end

  describe "POST /admin/cover_offers/broadcast — advertise an unfilled visit" do
    let(:su)    { create(:service_user) }
    let(:visit) { create(:visit, service_user: su, scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now, status: :published) }

    # NB: the test database carries seed data, so these assert against the
    # eligible SET rather than an absolute count — a hard-coded number here
    # would break the moment the seeds change.
    it "offers the visit to every eligible carer and returns the count the rota shows" do
      free_one = create(:employee)
      free_two = create(:employee)
      eligible = Employee.where(active: true).count

      post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: visit.id }, headers: auth, as: :json
      expect(response).to have_http_status(:created)

      body = response.parsed_body
      # `offered` is the number the console puts in its toast.
      expect(body["offered"]).to eq(eligible)
      expect(body["visit_id"]).to eq(visit.id)
      offered_ids = CoverOffer.where(visit: visit).pluck(:employee_id)
      expect(offered_ids).to include(free_one.id, free_two.id)
      expect(offered_ids.size).to eq(eligible)
      expect(CoverOffer.where(visit: visit).pluck(:state).uniq).to eq([ "pending" ])
    end

    it "excludes a carer already booked on an overlapping visit" do
      free   = create(:employee)
      booked = create(:employee)
      clash  = create(:visit, service_user: create(:service_user),
                              scheduled_start: visit.scheduled_start, scheduled_end: visit.scheduled_end)
      create(:visit_assignment, visit: clash, employee: booked)
      eligible = Employee.where(active: true).count

      post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: visit.id }, headers: auth, as: :json
      expect(response).to have_http_status(:created)

      offered_ids = CoverOffer.where(visit: visit).pluck(:employee_id)
      expect(offered_ids).to include(free.id)
      expect(offered_ids).not_to include(booked.id)          # the clash is the point
      expect(response.parsed_body["offered"]).to eq(eligible - 1)
    end

    it "is idempotent — re-advertising reuses the pending offers rather than duplicating them" do
      create(:employee)
      post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: visit.id }, headers: auth, as: :json
      expect do
        post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: visit.id }, headers: auth, as: :json
      end.not_to change(CoverOffer, :count)
      expect(response).to have_http_status(:created)
    end

    it "refuses to advertise a visit that is already fully staffed (422)" do
      create(:visit_assignment, visit: visit, employee: create(:employee))
      post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: visit.id }, headers: auth, as: :json
      expect(response).to have_http_status(422)
      expect(response.parsed_body["error"]).to eq("visit_already_filled")
    end
  end
end
