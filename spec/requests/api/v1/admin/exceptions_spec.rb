require "rails_helper"

RSpec.describe "Admin exceptions queue", type: :request do
  let(:admin)   { create(:admin) }
  let(:auth)    { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:su)      { create(:service_user) }
  let(:carer)   { create(:employee) }

  it "lists pending-review visits with the carer's name" do
    visit = create(:visit, service_user: su)
    create(:visit_assignment, visit: visit, employee: carer, lifecycle_state: "pending_review")

    get "/api/v1/admin/exceptions", headers: auth
    expect(response).to have_http_status(:ok)
    pr = response.parsed_body["pending_review"]
    expect(pr.size).to eq(1)
    # The queue must be able to show WHO — the carer, by name.
    expect(pr.first.dig("employee", "full_name")).to eq(carer.full_name)
    expect(pr.first.dig("visit", "service_user", "full_name")).to eq(su.full_name)
  end

  it "lists open alerts with carer/client context" do
    visit = create(:visit, service_user: su)
    va = create(:visit_assignment, visit: visit, employee: carer)
    Alert.create!(alert_type: "geo_anomaly", subject: va, state: "open")

    get "/api/v1/admin/exceptions", headers: auth
    alerts = response.parsed_body["open_alerts"]
    expect(alerts.size).to eq(1)
    expect(alerts.first["carer"]).to eq(carer.full_name)
    expect(alerts.first["client"]).to eq(su.full_name)
  end
end
