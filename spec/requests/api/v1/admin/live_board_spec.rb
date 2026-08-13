require "rails_helper"

RSpec.describe "Admin live board", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:su)    { create(:service_user) }
  let(:carer) { create(:employee) }

  it "returns today's assignments with the carer name and counts" do
    # Pin to midday so the window can't roll past midnight when the suite runs late.
    noon = Date.current.beginning_of_day + 12.hours
    visit = create(:visit, service_user: su, scheduled_start: noon, scheduled_end: noon + 1.hour)
    create(:visit_assignment, visit: visit, employee: carer, lifecycle_state: "scheduled")

    get "/api/v1/admin/live_board", headers: auth
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    a = body["assignments"].first
    # The board must show WHO is on each visit — not "Unassigned".
    expect(a.dig("employee", "full_name")).to eq(carer.full_name)
    expect(a.dig("visit", "service_user", "full_name")).to eq(su.full_name)
    expect(body["counts"]).to include("scheduled" => 1)
  end

  it "does not include visits scheduled for other days" do
    visit = create(:visit, service_user: su, scheduled_start: 2.days.from_now, scheduled_end: 2.days.from_now + 1.hour)
    create(:visit_assignment, visit: visit, employee: carer)

    get "/api/v1/admin/live_board", headers: auth
    expect(response.parsed_body["assignments"]).to be_empty
  end
end
