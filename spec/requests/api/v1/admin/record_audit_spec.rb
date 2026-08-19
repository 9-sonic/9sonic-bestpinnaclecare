require "rails_helper"

RSpec.describe "Client and staff record edits are audited", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }

  describe "ServiceUser (client)" do
    it "records service_user.created with the new field values" do
      post "/api/v1/admin/service_users",
           params: { first_name: "Ada", last_name: "Whitfield", postcode: "M1 1AA" }, headers: auth, as: :json
      expect(response).to have_http_status(:created)
      su_id = response.parsed_body["id"]

      event = Event.find_by(event_type: "service_user.created", aggregate_type: "ServiceUser", aggregate_id: su_id)
      expect(event).to be_present
      expect(event.actor).to eq(admin)
      expect(event.payload.dig("changes", "first_name")).to eq("Ada")
    end

    it "records service_user.updated with before/after only for changed fields" do
      su = create(:service_user, first_name: "Ada", city: "Manchester")

      patch "/api/v1/admin/service_users/#{su.id}",
            params: { city: "Salford" }, headers: auth, as: :json
      expect(response).to have_http_status(:ok)

      event = Event.find_by(event_type: "service_user.updated", aggregate: su)
      expect(event).to be_present
      expect(event.payload["from"]).to eq("city" => "Manchester")
      expect(event.payload["to"]).to eq("city" => "Salford")
      expect(event.payload["from"]).not_to have_key("first_name")
    end

    it "does not record an event when nothing actually changed" do
      su = create(:service_user, city: "Manchester")
      expect {
        patch "/api/v1/admin/service_users/#{su.id}", params: { city: "Manchester" }, headers: auth, as: :json
      }.not_to change { Event.where(event_type: "service_user.updated", aggregate: su).count }
    end
  end

  describe "Employee (staff)" do
    it "records employee.invited on create" do
      post "/api/v1/admin/employees",
           params: { first_name: "Tom", last_name: "Carer", email: "tom.carer@bpc.test" }, headers: auth, as: :json
      expect(response).to have_http_status(:created)
      employee_id = response.parsed_body["id"]

      event = Event.find_by(event_type: "employee.invited", aggregate_type: "Employee", aggregate_id: employee_id)
      expect(event).to be_present
      expect(event.actor).to eq(admin)
      expect(event.payload["email"]).to eq("tom.carer@bpc.test")
    end

    it "records employee.updated with before/after for changed fields" do
      employee = create(:employee, phone: "0161 000 0000")

      patch "/api/v1/admin/employees/#{employee.id}",
            params: { phone: "0161 111 1111" }, headers: auth, as: :json
      expect(response).to have_http_status(:ok)

      event = Event.find_by(event_type: "employee.updated", aggregate: employee)
      expect(event).to be_present
      expect(event.payload["from"]).to eq("phone" => "0161 000 0000")
      expect(event.payload["to"]).to eq("phone" => "0161 111 1111")
    end
  end
end
