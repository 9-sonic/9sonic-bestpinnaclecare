require "rails_helper"

RSpec.describe "Admin carer 360", type: :request do
  let(:admin)    { create(:admin) }
  let(:auth)     { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:su)       { create(:service_user, lat: 53.4808, lng: -2.2426) }
  let(:carer)    { create(:employee) }
  let(:visit)    { create(:visit, service_user: su, scheduled_start: 30.minutes.ago, scheduled_end: 30.minutes.from_now) }
  let(:va)       { create(:visit_assignment, visit: visit, employee: carer) }

  # A clock event written through the real service so append-only rules hold.
  def clock_in!
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: Time.current, lat: 53.4808, lng: -2.2426, actor: carer
    )
  end

  it "GET profile returns the carer summary, counts and recent slices" do
    va
    VisitNote.create!(visit_assignment: va, author: carer, body: "All well today", client_note_id: SecureRandom.uuid)
    clock_in!
    carer.carer_requests.create!(kind: "drop", summary: "Please cancel Friday", state: "pending")

    get "/api/v1/admin/employees/#{carer.id}/profile", headers: auth
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body["employee"]["id"]).to eq(carer.id)
    expect(body["counts"]).to include("visits" => 1, "notes" => 1, "open_requests" => 1)
    expect(body["recent_notes"].first).to include("body" => "All well today", "service_user" => su.full_name)
    expect(body["recent_clock"].first["kind"]).to eq("clock_in")
    expect(body["open_requests"].first["summary"]).to eq("Please cancel Friday")
  end

  it "GET visits returns this carer's assignments, paginated" do
    va
    get "/api/v1/admin/employees/#{carer.id}/visits", headers: auth
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body).to include("page" => 1, "total" => 1)
    expect(body["items"].first["visit_id"]).to eq(visit.id)
  end

  it "GET notes returns only notes this carer wrote" do
    other = create(:employee)
    other_va = create(:visit_assignment, visit: create(:visit, service_user: su), employee: other)
    VisitNote.create!(visit_assignment: va, author: carer, body: "Mine", client_note_id: SecureRandom.uuid)
    VisitNote.create!(visit_assignment: other_va, author: other, body: "Theirs", client_note_id: SecureRandom.uuid)

    get "/api/v1/admin/employees/#{carer.id}/notes", headers: auth
    bodies = response.parsed_body["items"].map { |n| n["body"] }
    expect(bodies).to eq([ "Mine" ])
  end

  it "GET clock_events returns this carer's clock history" do
    clock_in!
    get "/api/v1/admin/employees/#{carer.id}/clock_events", headers: auth
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["items"].first).to include("kind" => "clock_in", "service_user" => su.full_name)
  end

  it "GET requests returns all of this carer's requests" do
    carer.carer_requests.create!(kind: "leave", summary: "Annual leave", state: "pending")
    carer.carer_requests.create!(kind: "swap", summary: "Swap Tuesday", state: "approved")
    get "/api/v1/admin/employees/#{carer.id}/requests", headers: auth
    expect(response.parsed_body["total"]).to eq(2)
  end

  describe "history filters (reach records from any point in time)" do
    let(:other_su) { create(:service_user, first_name: "Zed", last_name: "Client") }

    it "visits: from/to reaches an old visit and service_user_id scopes to one client" do
      old_v  = create(:visit, service_user: su, scheduled_start: 400.days.ago, scheduled_end: 400.days.ago + 30.minutes)
      create(:visit_assignment, visit: old_v, employee: carer)
      recent = create(:visit, service_user: other_su, scheduled_start: 1.day.ago, scheduled_end: 1.day.ago + 30.minutes)
      create(:visit_assignment, visit: recent, employee: carer)

      # A wide date range that includes the 400-day-old visit finds it.
      get "/api/v1/admin/employees/#{carer.id}/visits", params: { from: 500.days.ago.to_date.iso8601, to: Date.current.iso8601 }, headers: auth
      expect(response.parsed_body["total"]).to eq(2)

      # Narrow to just the old window -> only the old visit.
      get "/api/v1/admin/employees/#{carer.id}/visits", params: { from: 410.days.ago.to_date.iso8601, to: 390.days.ago.to_date.iso8601 }, headers: auth
      expect(response.parsed_body["total"]).to eq(1)
      expect(response.parsed_body["items"].first["visit_id"]).to eq(old_v.id)

      # Scope by client.
      get "/api/v1/admin/employees/#{carer.id}/visits", params: { service_user_id: other_su.id }, headers: auth
      expect(response.parsed_body["total"]).to eq(1)
      expect(response.parsed_body["items"].first["visit_id"]).to eq(recent.id)
    end

    it "notes: q searches the body and treats % / _ literally" do
      VisitNote.create!(visit_assignment: va, author: carer, body: "Gave 50% of the meal", client_note_id: SecureRandom.uuid)
      VisitNote.create!(visit_assignment: va, author: carer, body: "Client slept well", client_note_id: SecureRandom.uuid)

      get "/api/v1/admin/employees/#{carer.id}/notes", params: { q: "slept" }, headers: auth
      expect(response.parsed_body["items"].map { |n| n["body"] }).to eq([ "Client slept well" ])

      # A literal % must not act as a wildcard matching everything.
      get "/api/v1/admin/employees/#{carer.id}/notes", params: { q: "50%" }, headers: auth
      expect(response.parsed_body["items"].map { |n| n["body"] }).to eq([ "Gave 50% of the meal" ])
    end

    it "does not 500 on a garbage date" do
      va
      get "/api/v1/admin/employees/#{carer.id}/visits", params: { from: "not-a-date" }, headers: auth
      expect(response).to have_http_status(:ok)
    end
  end

  it "GET mileage returns this carer's travel claims, newest first, with the client when tied to a visit" do
    carer.mileage_claims.create!(travel_date: Date.current, miles: 4.2, source: "carer", state: "claimed",
                                 visit_assignment: va, from_label: "Base", to_label: "Client")
    carer.mileage_claims.create!(travel_date: 3.days.ago, miles: 1.5, source: "carer", state: "claimed")

    get "/api/v1/admin/employees/#{carer.id}/mileage", headers: auth
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body["total"]).to eq(2)
    first = body["items"].first
    expect(first).to include("miles" => 4.2, "from_label" => "Base", "service_user" => su.full_name)
  end
end
