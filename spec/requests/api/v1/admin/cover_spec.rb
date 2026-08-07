require "rails_helper"

RSpec.describe "Admin cover", type: :request do
  let(:admin)    { create(:admin) }
  let(:auth)     { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:su)       { create(:service_user) }
  let(:employee) { create(:employee) }

  def open_visit
    create(:visit, service_user: su, status: "published",
                   scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now)
  end

  it "lists unfilled published visits as open shifts" do
    v = open_visit
    get "/api/v1/admin/cover", headers: auth
    expect(response).to have_http_status(:ok)

    ids = response.parsed_body["open_shifts"].map { |s| s["visit"]["id"] }
    expect(ids).to include(v.id)
    expect(response.parsed_body["counts"]["open"]).to be >= 1
  end

  it "offers a shift, then accepting fills it and creates an assignment" do
    v = open_visit
    post "/api/v1/admin/cover_offers", params: { visit_id: v.id, employee_id: employee.id }, headers: auth, as: :json
    expect(response).to have_http_status(:created)
    offer_id = response.parsed_body["id"]

    post "/api/v1/admin/cover_offers/#{offer_id}/accept", headers: auth
    expect(response).to have_http_status(:ok)
    expect(VisitAssignment.where(visit: v, employee: employee, assignment_status: "assigned")).to exist

    get "/api/v1/admin/cover", headers: auth
    ids = response.parsed_body["open_shifts"].map { |s| s["visit"]["id"] }
    expect(ids).not_to include(v.id) # filled, so it drops off the board
  end

  it "declining records the offer as declined" do
    v = open_visit
    post "/api/v1/admin/cover_offers", params: { visit_id: v.id, employee_id: employee.id }, headers: auth, as: :json
    offer_id = response.parsed_body["id"]
    post "/api/v1/admin/cover_offers/#{offer_id}/decline", headers: auth
    expect(response.parsed_body["state"]).to eq("declined")
  end

  it "writes cover offers to the audit trail" do
    v = open_visit
    post "/api/v1/admin/cover_offers", params: { visit_id: v.id, employee_id: employee.id }, headers: auth, as: :json
    get "/api/v1/admin/audit", params: { event_type: "cover.offered" }, headers: auth
    expect(response.parsed_body.first["event_type"]).to eq("cover.offered")
  end
end
