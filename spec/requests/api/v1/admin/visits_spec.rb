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

    post "/api/v1/admin/visits/generate",
         params: { from: Date.current.iso8601, to: (Date.current + 2).iso8601 }, headers: auth, as: :json
    expect(response).to have_http_status(:created)
    expect(response.parsed_body["created"]).to eq(3)

    get "/api/v1/admin/visits", params: { from: Date.current.iso8601, to: (Date.current + 2).iso8601 }, headers: auth
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
end
