require "rails_helper"

RSpec.describe "Staff visits (carer's own rota)", type: :request do
  let(:employee)     { create(:employee) }
  let(:service_user) { create(:service_user) }
  let(:auth)         { { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" } }

  def assign(status:)
    visit = create(:visit, service_user: service_user, status: status,
                   scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now)
    create(:visit_assignment, visit: visit, employee: employee)
    visit
  end

  it "returns the carer's published visits" do
    published = assign(status: :published)
    get "/api/v1/staff/visits", headers: auth
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body.map { |va| va.dig("visit", "id") }).to include(published.id)
  end

  it "does not return a draft visit — the office is still planning it" do
    draft = assign(status: :draft)
    get "/api/v1/staff/visits", headers: auth
    expect(response.parsed_body.map { |va| va.dig("visit", "id") }).not_to include(draft.id)
  end

  it "does not return a cancelled visit (its assignment is withdrawn)" do
    visit = assign(status: :published)
    visit.visit_assignments.first.update!(assignment_status: "withdrawn")
    visit.update!(status: :cancelled)
    get "/api/v1/staff/visits", headers: auth
    expect(response.parsed_body).to be_empty
  end
end
