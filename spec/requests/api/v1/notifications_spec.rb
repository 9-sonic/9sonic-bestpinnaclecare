require "rails_helper"

RSpec.describe "Notifications", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }

  def raise_alert(type)
    va = create(:visit_assignment, visit: create(:visit, service_user: create(:service_user)))
    Alerts::Raise.call(subject: va, alert_type: type, severity: "high")
  end

  it "fans a newly raised alert out to admins as an in-app notification" do
    admin # ensure the recipient exists first
    expect { raise_alert("missed_visit") }
      .to change { admin.notifications.where(channel: "in_app").count }.by(1)
  end

  it "does not re-notify on a deduped re-raise" do
    admin
    va = create(:visit_assignment, visit: create(:visit, service_user: create(:service_user)))
    Alerts::Raise.call(subject: va, alert_type: "missed_visit")
    expect { Alerts::Raise.call(subject: va, alert_type: "missed_visit") }
      .not_to change { admin.notifications.count }
  end

  it "lists notifications and marks one seen" do
    admin
    raise_alert("missed_visit")
    get "/api/v1/notifications", headers: auth
    expect(response).to have_http_status(:ok)
    id = response.parsed_body.first["id"]

    post "/api/v1/notifications/#{id}/seen", headers: auth
    expect(response.parsed_body["seen_at"]).to be_present
  end

  it "respects a disabled preference for a non-critical alert" do
    admin.notification_preferences.create!(notification_type: "geo_anomaly", in_app: false, push: false)
    expect { raise_alert("geo_anomaly") }.not_to change { admin.notifications.count }
  end

  it "delivers critical alerts in-app even when the preference is off" do
    admin.notification_preferences.create!(notification_type: "missed_visit", in_app: false, push: false)
    expect { raise_alert("missed_visit") }
      .to change { admin.notifications.where(channel: "in_app").count }.by(1)
  end

  it "reads and updates preferences (shared endpoint, admin token)" do
    patch "/api/v1/notification_preferences",
          params: { notification_type: "geo_anomaly", in_app: false, push: true, email: true }, headers: auth, as: :json
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body).to include("notification_type" => "geo_anomaly", "in_app" => false, "email" => true)
  end
end
