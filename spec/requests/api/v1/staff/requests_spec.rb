require "rails_helper"

RSpec.describe "Staff carer requests", type: :request do
  let(:employee) { create(:employee) }
  let(:auth)     { { "Authorization" => "Bearer #{jwt_for(employee, :employee)}" } }
  let(:visit)    { create(:visit, service_user: create(:service_user), scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now) }
  let(:va)       { create(:visit_assignment, visit: visit, employee: employee, lifecycle_state: "scheduled") }

  def drop(assignment)
    post "/api/v1/staff/requests",
         params: { kind: "drop", summary: "Cover needed", payload: { visit_assignment_id: assignment.id } },
         headers: auth, as: :json
  end

  it "raises a drop (cover) request on a visit that hasn't happened yet" do
    expect { drop(va) }.to change(CarerRequest, :count).by(1)
    expect(response).to have_http_status(:created)
  end

  %w[completed missed cancelled].each do |state|
    it "refuses to request cover once the shift is #{state} (422)" do
      va.update!(lifecycle_state: state)
      expect { drop(va) }.not_to change(CarerRequest, :count)
      expect(response).to have_http_status(422)
      expect(response.parsed_body["error"]).to eq("visit_already_over")
    end
  end

  it "refuses a drop request for another carer's assignment" do
    other = create(:visit_assignment, visit: create(:visit, service_user: create(:service_user), scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now))
    expect { drop(other) }.not_to change(CarerRequest, :count)
    expect(response).to have_http_status(422)
    expect(response.parsed_body["error"]).to eq("assignment_not_found")
  end

  it "still allows non-drop requests (e.g. leave) unaffected by the visit-state check" do
    expect do
      post "/api/v1/staff/requests",
           params: { kind: "leave", summary: "Annual leave" }, headers: auth, as: :json
    end.to change(CarerRequest, :count).by(1)
    expect(response).to have_http_status(:created)
  end
end
