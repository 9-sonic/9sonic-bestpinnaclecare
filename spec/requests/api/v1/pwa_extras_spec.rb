require "rails_helper"

RSpec.describe "PWA extras (chat names, notifications, admin care plan)", type: :request do
  let(:rm)         { create(:admin, role: :registered_manager) }
  let(:coord)      { create(:admin, role: :coordinator) }
  let(:employee)   { create(:employee) }
  let(:rm_auth)    { { "Authorization" => "Bearer #{jwt_for(rm, :admin)}" } }
  let(:coord_auth) { { "Authorization" => "Bearer #{jwt_for(coord, :admin)}" } }
  let(:emp_auth)   { { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" } }
  let(:su)         { create(:service_user) }

  it "embeds participant names + last-message preview" do
    post "/api/v1/conversations", params: { kind: "direct", participant: { type: "Employee", id: employee.id } }, headers: rm_auth, as: :json
    convo_id = response.parsed_body["id"]
    post "/api/v1/conversations/#{convo_id}/messages", params: { body: "Hello there", client_message_id: SecureRandom.uuid }, headers: rm_auth, as: :json

    get "/api/v1/conversations", headers: emp_auth
    convo = response.parsed_body.find { |c| c["id"] == convo_id }
    expect(convo["participants"].map { |p| p["full_name"] }).to include(rm.full_name, employee.full_name)
    expect(convo["last_message_preview"]).to eq("Hello there")
  end

  it "marks all notifications read at once and filters unseen" do
    rm # ensure the recipient exists first
    3.times { Alerts::Raise.call(subject: create(:visit_assignment, visit: create(:visit, service_user: su)), alert_type: "missed_visit") }

    get "/api/v1/notifications", params: { unseen: true }, headers: rm_auth
    expect(response.parsed_body.size).to be >= 3

    post "/api/v1/notifications/seen_all", headers: rm_auth
    expect(response.parsed_body["updated"]).to be >= 3

    get "/api/v1/notifications", params: { unseen: true }, headers: rm_auth
    expect(response.parsed_body).to be_empty
  end

  it "manages a service user's care plan (admin)" do
    post "/api/v1/admin/service_users/#{su.id}/care_plan_items", params: { category: "allergy", label: "Penicillin" }, headers: rm_auth, as: :json
    expect(response).to have_http_status(:created)
    get "/api/v1/admin/service_users/#{su.id}/care_plan_items", headers: rm_auth
    expect(response.parsed_body.size).to eq(1)
  end

  it "shows an employee's availability to the office" do
    employee.employee_availabilities.create!(weekday: 1, slot: "morning", available: true)
    get "/api/v1/admin/employees/#{employee.id}/availability", headers: rm_auth
    expect(response.parsed_body.size).to eq(1)
  end
end
