require "rails_helper"

RSpec.describe "Code-review security fixes", type: :request do
  let(:su) { create(:service_user, lat: 53.4808, lng: -2.2426) }

  describe "mileage cannot be attached to another carer's visit (IDOR)" do
    it "rejects a foreign visit_assignment_id" do
      me = create(:employee)
      foreign = create(:visit_assignment, employee: create(:employee), visit: create(:visit, service_user: su))
      post "/api/v1/staff/mileage",
           params: { travel_date: Date.current.iso8601, miles: 3, visit_assignment_id: foreign.id },
           headers: { "Authorization" => "Bearer #{jwt_for(me, :employee)}" }, as: :json
      expect(response).to have_http_status(422)
      expect(MileageClaim.count).to eq(0)
    end

    it "accepts the carer's own visit_assignment_id" do
      me = create(:employee)
      mine = create(:visit_assignment, employee: me, visit: create(:visit, service_user: su))
      post "/api/v1/staff/mileage",
           params: { travel_date: Date.current.iso8601, miles: 3, visit_assignment_id: mine.id },
           headers: { "Authorization" => "Bearer #{jwt_for(me, :employee)}" }, as: :json
      expect(response).to have_http_status(:created)
    end
  end

  describe "care plan items are scoped to their service user (IDOR)" do
    it "404s when editing an item via the wrong service_user_id" do
      mgr = create(:admin, role: :manager)
      other_su = create(:service_user)
      item = su.care_plan_items.create!(category: "medication", label: "original")
      patch "/api/v1/admin/service_users/#{other_su.id}/care_plan_items/#{item.id}",
            params: { label: "hacked" }, headers: { "Authorization" => "Bearer #{jwt_for(mgr, :admin)}" }, as: :json
      expect(response).to have_http_status(:not_found)
      expect(item.reload.label).to eq("original")
    end

    it "forbids an auditor from editing care plans" do
      auditor = create(:admin, role: :auditor)
      post "/api/v1/admin/service_users/#{su.id}/care_plan_items",
           params: { category: "x", label: "y" }, headers: { "Authorization" => "Bearer #{jwt_for(auditor, :admin)}" }, as: :json
      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "bad params don't 500" do
    it "summary tolerates garbage from/to" do
      emp = create(:employee)
      get "/api/v1/staff/summary", params: { from: "not-a-date", to: "nonsense" }, headers: { "Authorization" => "Bearer #{jwt_for(emp, :employee)}" }
      expect(response).to have_http_status(:ok)
    end

    it "notifications tolerates a garbage before cursor" do
      admin = create(:admin)
      get "/api/v1/notifications", params: { before: "garbage" }, headers: { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" }
      expect(response).to have_http_status(:ok)
    end
  end

  describe "device push subscription stored via strong params" do
    it "keeps only the standard Web Push shape" do
      emp = create(:employee)
      post "/api/v1/staff/devices",
           params: { fingerprint: SecureRandom.uuid, platform: "iOS",
                     push_subscription: { endpoint: "https://push", keys: { p256dh: "x", auth: "y" }, evil: "drop" } },
           headers: { "Authorization" => "Bearer #{jwt_for(emp, :employee)}" }, as: :json
      expect(response).to have_http_status(:created)
      sub = emp.devices.last.push_subscription
      expect(sub["endpoint"]).to eq("https://push")
      expect(sub).not_to have_key("evil")
    end
  end
end
