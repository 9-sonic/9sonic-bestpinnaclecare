require "rails_helper"

RSpec.describe "Admin reports", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:su)    { create(:service_user) }

  def visit_at(start)
    create(:visit, service_user: su, scheduled_start: start, scheduled_end: start + 1.hour)
  end

  it "aggregates completed, late and missed over the range" do
    create(:visit_assignment, visit: visit_at(2.hours.ago), lifecycle_state: "completed",
           actual_start: 2.hours.ago, actual_end: 1.hour.ago, worked_minutes: 60)

    late_v = visit_at(3.hours.ago)
    create(:visit_assignment, visit: late_v, lifecycle_state: "completed",
           actual_start: 3.hours.ago + 40.minutes, actual_end: 2.hours.ago, worked_minutes: 60)

    create(:visit_assignment, visit: visit_at(4.hours.ago), lifecycle_state: "missed")

    get "/api/v1/admin/reports", headers: auth
    expect(response).to have_http_status(:ok)

    body = response.parsed_body
    expect(body["summary"]["verified_hours"]).to eq(2.0)
    expect(body["summary"]).to have_key("attendance_pct")
    expect(body["summary"]).to have_key("on_time_pct")
    expect(body["attendance_by_day"]).to be_an(Array)
    expect(body["hours_by_carer"]).to be_an(Array)
    expect(body["late_by_client"]).to be_an(Array)
  end

  it "counts pending_review visits against attendance instead of hiding them" do
    create(:visit_assignment, visit: visit_at(2.hours.ago), lifecycle_state: "completed",
           actual_start: 2.hours.ago, actual_end: 1.hour.ago, worked_minutes: 60)
    create(:visit_assignment, visit: visit_at(3.hours.ago), lifecycle_state: "pending_review")

    get "/api/v1/admin/reports", headers: auth
    summary = response.parsed_body["summary"]
    expect(summary["unresolved"]).to eq(1)
    expect(summary["attendance_pct"]).to eq(50) # 1 done of (1 done + 1 unresolved), not 100
  end

  it "reports location integrity from clock-in geofence results" do
    gesu = create(:service_user, lat: 53.4808, lng: -2.2426, geofence_radius_m: 150)
    v = create(:visit, service_user: gesu, scheduled_start: 20.minutes.ago, scheduled_end: 40.minutes.from_now)
    va = create(:visit_assignment, visit: v, employee: create(:employee))
    # A real on-site clock-in through the pipeline -> geofence pass.
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: Time.current, lat: 53.4808, lng: -2.2426, actor: va.employee
    )

    get "/api/v1/admin/reports", headers: auth
    loc = response.parsed_body["location"]
    expect(loc["clock_ins"]).to be >= 1
    expect(loc["on_site"]).to be >= 1
    expect(loc).to have_key("no_gps_fix")
    expect(loc).to have_key("needs_review")
  end

  it "reports care-task completion across completed visits" do
    v = visit_at(2.hours.ago)
    va = create(:visit_assignment, visit: v, lifecycle_state: "completed",
                actual_start: 2.hours.ago, actual_end: 1.hour.ago, worked_minutes: 60)
    cpi = create(:care_plan_item, service_user: su)
    va.visit_tasks.create!(care_plan_item: cpi, label: cpi.label, done: true, completed_at: Time.current)
    va.visit_tasks.create!(label: "Second task", done: false)

    get "/api/v1/admin/reports", headers: auth
    su_body = response.parsed_body["summary"]
    expect(su_body["tasks_total"]).to eq(2)
    expect(su_body["tasks_done"]).to eq(1)
    expect(su_body["tasks_pct"]).to eq(50)
  end

  describe "staffing / cover health" do
    def published_visit_at(start, staff_required: 1)
      create(:visit, service_user: su, scheduled_start: start, scheduled_end: start + 1.hour,
             status: :published, staff_required: staff_required)
    end

    it "counts a visit that never needed cover as outside the cover-need figures" do
      v = published_visit_at(2.hours.ago)
      create(:visit_assignment, visit: v, lifecycle_state: "completed")

      get "/api/v1/admin/reports", headers: auth
      st = response.parsed_body["staffing"]
      expect(st["total_visits"]).to eq(1)
      expect(st["needed_cover"]).to eq(0)
      expect(st["cover_rate_pct"]).to eq(0)
    end

    it "counts a visit that got a cover offer and was filled" do
      v = published_visit_at(2.hours.ago)
      offered = 3.hours.ago
      responded = offered + 20.minutes
      offer = create(:cover_offer, visit: v, state: "accepted", offered_at: offered, responded_at: responded)
      create(:visit_assignment, visit: v, employee: offer.employee, assignment_status: "assigned", lifecycle_state: "completed")

      get "/api/v1/admin/reports", headers: auth
      st = response.parsed_body["staffing"]
      expect(st["needed_cover"]).to eq(1)
      expect(st["filled"]).to eq(1)
      expect(st["still_unfilled"]).to eq(0)
      expect(st["fill_rate_pct"]).to eq(100)
      expect(st["avg_time_to_fill_min"]).to eq(20)
    end

    it "counts a visit that got offered but never accepted as still unfilled" do
      v = published_visit_at(2.hours.ago)
      create(:cover_offer, visit: v, state: "pending")

      get "/api/v1/admin/reports", headers: auth
      st = response.parsed_body["staffing"]
      expect(st["needed_cover"]).to eq(1)
      expect(st["filled"]).to eq(0)
      expect(st["still_unfilled"]).to eq(1)
      expect(st["fill_rate_pct"]).to eq(0)
      expect(st["avg_time_to_fill_min"]).to be_nil
    end

    it "surfaces which clients most often needed cover" do
      hard_to_staff = create(:service_user, first_name: "Hard", last_name: "ToStaff")
      v1 = create(:visit, service_user: hard_to_staff, scheduled_start: 2.hours.ago, scheduled_end: 1.hour.ago, status: :published)
      v2 = create(:visit, service_user: hard_to_staff, scheduled_start: 4.hours.ago, scheduled_end: 3.hours.ago, status: :published)
      create(:cover_offer, visit: v1, state: "pending")
      create(:cover_offer, visit: v2, state: "pending")

      get "/api/v1/admin/reports", headers: auth
      cover_by_client = response.parsed_body["cover_by_client"]
      entry = cover_by_client.find { |c| c["client"] == "Hard ToStaff" }
      expect(entry["visits"]).to eq(2)
      expect(entry["unfilled"]).to eq(2)
    end

    it "does not count a draft visit toward staffing (only published visits are live rota)" do
      create(:visit, service_user: su, scheduled_start: 2.hours.ago, scheduled_end: 1.hour.ago, status: :draft)

      get "/api/v1/admin/reports", headers: auth
      expect(response.parsed_body["staffing"]["total_visits"]).to eq(0)
    end
  end

  describe "carer requests (swap/drop/overtime/availability/leave)" do
    let(:carer) { create(:employee) }

    def raise_request(kind:, created_at: 1.hour.ago, state: "pending", decided_at: nil, employee: carer)
      req = CarerRequest.create!(employee: employee, kind: kind, summary: "test", state: state, decided_at: decided_at)
      req.update_column(:created_at, created_at) # created_at is normally now(); backdate for range tests
      req
    end

    it "counts requests raised in range by outcome and kind" do
      raise_request(kind: "leave", state: "pending")
      raise_request(kind: "swap", state: "approved", decided_at: 30.minutes.ago)
      raise_request(kind: "swap", state: "declined", decided_at: 20.minutes.ago)

      get "/api/v1/admin/reports", headers: auth
      rq = response.parsed_body["requests"]
      expect(rq["total"]).to eq(3)
      expect(rq["pending"]).to eq(1)
      expect(rq["approved"]).to eq(1)
      expect(rq["declined"]).to eq(1)
      expect(rq["approval_rate_pct"]).to eq(50) # 1 of 2 decided

      by_kind = rq["by_kind"].index_by { |k| k["kind"] }
      expect(by_kind["swap"]["count"]).to eq(2)
      expect(by_kind["leave"]["count"]).to eq(1)
      expect(by_kind["drop"]["count"]).to eq(0)
    end

    it "computes average turnaround from raised to decided" do
      raise_request(kind: "overtime", created_at: 2.hours.ago, state: "approved", decided_at: 1.hour.ago)

      get "/api/v1/admin/reports", headers: auth
      expect(response.parsed_body["requests"]["avg_turnaround_hours"]).to eq(1.0)
    end

    it "excludes a request raised outside the range" do
      raise_request(kind: "leave", created_at: 30.days.ago, state: "pending")

      get "/api/v1/admin/reports", headers: auth
      expect(response.parsed_body["requests"]["total"]).to eq(0)
    end

    it "surfaces which carers are raising the most requests" do
      busy = create(:employee, first_name: "Busy", last_name: "Carer")
      raise_request(kind: "swap", employee: busy)
      raise_request(kind: "drop", employee: busy)

      get "/api/v1/admin/reports", headers: auth
      by_carer = response.parsed_body["requests_by_carer"]
      entry = by_carer.find { |c| c["carer"] == "Busy Carer" }
      expect(entry["total"]).to eq(2)
      expect(entry["pending"]).to eq(2)
    end
  end

  describe "per-carer reliability" do
    it "reports on-time, late and missed counts per carer" do
      reliable = create(:employee, first_name: "Reliable", last_name: "Carer")
      v1 = visit_at(2.hours.ago)
      create(:visit_assignment, visit: v1, employee: reliable, lifecycle_state: "completed",
             actual_start: 2.hours.ago, actual_end: 1.hour.ago, worked_minutes: 60)
      v2 = visit_at(4.hours.ago)
      create(:visit_assignment, visit: v2, employee: reliable, lifecycle_state: "completed",
             actual_start: 4.hours.ago + 40.minutes, actual_end: 3.hours.ago, worked_minutes: 60) # late
      v3 = visit_at(6.hours.ago)
      create(:visit_assignment, visit: v3, employee: reliable, lifecycle_state: "missed")

      get "/api/v1/admin/reports", headers: auth
      row = response.parsed_body["carer_reliability"].find { |c| c["carer"] == "Reliable Carer" }
      expect(row["visits"]).to eq(3) # 2 completed + 1 missed
      expect(row["on_time"]).to eq(1)
      expect(row["late"]).to eq(1)
      expect(row["missed"]).to eq(1)
      expect(row["on_time_pct"]).to eq(50) # 1 of 2 completed
    end

    it "sorts worst on-time rate first" do
      good = create(:employee, first_name: "Good", last_name: "Carer")
      bad = create(:employee, first_name: "Bad", last_name: "Carer")
      create(:visit_assignment, visit: visit_at(2.hours.ago), employee: good, lifecycle_state: "completed",
             actual_start: 2.hours.ago, actual_end: 1.hour.ago, worked_minutes: 60)
      create(:visit_assignment, visit: visit_at(4.hours.ago), employee: bad, lifecycle_state: "completed",
             actual_start: 4.hours.ago + 40.minutes, actual_end: 3.hours.ago, worked_minutes: 60)

      get "/api/v1/admin/reports", headers: auth
      names = response.parsed_body["carer_reliability"].map { |c| c["carer"] }
      expect(names.index("Bad Carer")).to be < names.index("Good Carer")
    end
  end

  describe "care delivery depth" do
    it "reports task completion and note volume across the period" do
      v = visit_at(2.hours.ago)
      va = create(:visit_assignment, visit: v, lifecycle_state: "completed",
                  actual_start: 2.hours.ago, actual_end: 1.hour.ago, worked_minutes: 60)
      va.visit_tasks.create!(label: "Task A", done: true, completed_at: Time.current)
      va.visit_tasks.create!(label: "Task B", done: false)
      va.visit_notes.create!(author: va.employee, body: "All good", client_note_id: SecureRandom.uuid)

      get "/api/v1/admin/reports", headers: auth
      cd = response.parsed_body["care_delivery"]
      expect(cd["tasks_total"]).to eq(2)
      expect(cd["tasks_done"]).to eq(1)
      expect(cd["tasks_pct"]).to eq(50)
      expect(cd["notes_recorded"]).to eq(1)
      expect(cd["visits_with_notes"]).to eq(1)
    end

    it "counts only the effective (non-superseded) note in note volume" do
      v = visit_at(2.hours.ago)
      va = create(:visit_assignment, visit: v, lifecycle_state: "completed")
      original = va.visit_notes.create!(author: va.employee, body: "First draft", client_note_id: SecureRandom.uuid)
      va.visit_notes.create!(author: va.employee, body: "Corrected", client_note_id: SecureRandom.uuid, supersedes: original)

      get "/api/v1/admin/reports", headers: auth
      expect(response.parsed_body["care_delivery"]["notes_recorded"]).to eq(1)
    end

    it "breaks down task completion by client and by carer" do
      su2 = create(:service_user, first_name: "Struggling", last_name: "Client")
      carer = create(:employee, first_name: "Behind", last_name: "OnTasks")
      v = create(:visit, service_user: su2, scheduled_start: 2.hours.ago, scheduled_end: 1.hour.ago)
      va = create(:visit_assignment, visit: v, employee: carer, lifecycle_state: "completed")
      va.visit_tasks.create!(label: "Task", done: false)

      get "/api/v1/admin/reports", headers: auth
      client_row = response.parsed_body["care_by_client"].find { |c| c["client"] == "Struggling Client" }
      carer_row = response.parsed_body["care_by_carer"].find { |c| c["carer"] == "Behind OnTasks" }
      expect(client_row["tasks_pct"]).to eq(0)
      expect(carer_row["tasks_pct"]).to eq(0)
    end

    it "excludes a visit with no tasks recorded from the by-client/by-carer breakdown" do
      v = visit_at(2.hours.ago)
      create(:visit_assignment, visit: v, lifecycle_state: "completed") # no visit_tasks created

      get "/api/v1/admin/reports", headers: auth
      expect(response.parsed_body["care_by_client"]).to eq([])
    end
  end

  it "requires an authenticated admin" do
    get "/api/v1/admin/reports"
    expect(response).to have_http_status(:unauthorized)
  end
end
