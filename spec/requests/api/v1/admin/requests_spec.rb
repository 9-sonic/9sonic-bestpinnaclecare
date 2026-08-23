require "rails_helper"

RSpec.describe "Admin carer requests", type: :request do
  let(:admin)    { create(:admin) }
  let(:auth)     { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:employee) { create(:employee) }

  def request_record(kind: "drop", state: "pending")
    CarerRequest.create!(employee: employee, kind: kind, state: state, summary: "#{kind} request")
  end

  it "lists requests pending first" do
    request_record(state: "approved")
    pending = request_record(state: "pending")

    get "/api/v1/admin/requests", headers: auth
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["items"].first["id"]).to eq(pending.id)
  end

  it "filters by kind" do
    request_record(kind: "drop")
    request_record(kind: "drop")
    get "/api/v1/admin/requests", params: { kind: "drop" }, headers: auth
    expect(response.parsed_body["items"].map { |r| r["kind"] }.uniq).to eq([ "drop" ])
  end

  it "approves a request and audits it" do
    req = request_record
    post "/api/v1/admin/requests/#{req.id}/approve", params: { note: "cover arranged" }, headers: auth, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["state"]).to eq("approved")
    expect(req.reload.decided_by).to eq(admin)

    get "/api/v1/admin/audit", params: { event_type: "request.approved" }, headers: auth
    expect(response.parsed_body.first["event_type"]).to eq("request.approved")
  end

  it "declines a request" do
    req = request_record
    post "/api/v1/admin/requests/#{req.id}/decline", headers: auth, as: :json
    expect(response.parsed_body["state"]).to eq("declined")
  end

  it "notifies the carer when their request is approved, carrying the manager's note" do
    req = request_record(kind: "drop")
    expect {
      post "/api/v1/admin/requests/#{req.id}/approve", params: { note: "Cover arranged, thanks." }, headers: auth, as: :json
    }.to change { employee.notifications.where(channel: "in_app").count }.by(1)

    note = employee.notifications.where(channel: "in_app").order(:created_at).last
    expect(note.title).to match(/approved/i)
    expect(note.body).to include("Cover arranged, thanks.") # the manager's reply reaches the carer
  end

  it "notifies the carer when their request is declined" do
    req = request_record(kind: "drop")
    expect {
      post "/api/v1/admin/requests/#{req.id}/decline", params: { note: "Already covered." }, headers: auth, as: :json
    }.to change { employee.notifications.where(channel: "in_app").count }.by(1)
    expect(employee.notifications.order(:created_at).last.title).to match(/declined/i)
  end

  it "lets a carer raise a request from the staff API" do
    emp_auth = { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" }
    post "/api/v1/staff/requests",
         params: { kind: "drop", summary: "Available for weekend hours" }, headers: emp_auth, as: :json
    expect(response).to have_http_status(:created)
    expect(employee.carer_requests.count).to eq(1)
  end

  it "approving a drop withdraws the carer so the visit surfaces in Cover" do
    su = create(:service_user, lat: 53.4808, lng: -2.2426)
    # Cover only surfaces PUBLISHED visits (a carer can only drop a shift they can
    # see, which is a published one).
    visit = create(:visit, service_user: su, status: :published, published_at: Time.current,
                   scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now)
    va = create(:visit_assignment, visit: visit, employee: employee)
    req = CarerRequest.create!(employee: employee, kind: "drop", state: "pending",
                               summary: "Please cover Friday", payload: { "visit_assignment_id" => va.id })

    post "/api/v1/admin/requests/#{req.id}/approve", headers: auth, as: :json
    expect(response).to have_http_status(:ok)

    # The carer is withdrawn — the assignment history is preserved, its status flipped.
    va.reload
    expect(va.assignment_status).to eq("withdrawn")
    expect(va.lifecycle_state).to eq("cancelled")

    # The now-unfilled visit shows up on the Cover board.
    get "/api/v1/admin/cover", headers: auth
    visit_ids = response.parsed_body["open_shifts"].map { |s| s["visit"]["id"] }
    expect(visit_ids).to include(visit.id)
  end

  it "closes the loop: drop → unfilled → another carer covers → assigned → off Cover" do
    su    = create(:service_user, lat: 53.4808, lng: -2.2426)
    visit = create(:visit, service_user: su, status: :published, published_at: Time.current,
                   scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now)
    va    = create(:visit_assignment, visit: visit, employee: employee)
    cover_carer = create(:employee)

    # 1. Carer drops the visit; office approves → carer withdrawn.
    req = CarerRequest.create!(employee: employee, kind: "drop", state: "pending",
                               summary: "Please cover", payload: { "visit_assignment_id" => va.id })
    post "/api/v1/admin/requests/#{req.id}/approve", headers: auth, as: :json
    expect(va.reload.assignment_status).to eq("withdrawn")

    # 2. It's now unfilled → office broadcasts it to carers.
    post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: visit.id }, headers: auth, as: :json
    expect(response).to have_http_status(:created)
    offer = CoverOffer.find_by(visit: visit, employee: cover_carer)
    expect(offer).to be_present # the dropping carer isn't re-offered their own drop implicitly; a fresh carer is

    # 3. Another carer accepts in the PWA → they're assigned to the visit.
    cover_auth = { "Authorization" => "Bearer #{jwt_for(cover_carer, :employee)}" }
    post "/api/v1/staff/cover_offers/#{offer.id}/accept", headers: cover_auth
    expect(response).to have_http_status(:ok)
    expect(VisitAssignment.where(visit: visit, employee: cover_carer, assignment_status: "assigned")).to exist

    # 4. The visit is filled again → it drops off the Cover board.
    get "/api/v1/admin/cover", headers: auth
    open_ids = response.parsed_body["open_shifts"].map { |s| s["visit"]["id"] }
    expect(open_ids).not_to include(visit.id)
  end
end
