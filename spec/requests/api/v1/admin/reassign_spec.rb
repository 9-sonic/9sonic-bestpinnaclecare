require "rails_helper"

RSpec.describe "Admin reassigns a visit to a different carer", type: :request do
  let(:admin)    { create(:admin) }
  let(:auth)     { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:visit)    { create(:visit) }
  let(:carer_a)  { create(:employee) }
  let(:carer_b)  { create(:employee) }
  let(:va)       { create(:visit_assignment, visit: visit, employee: carer_a) }

  def reassign(id, employee_id)
    post "/api/v1/admin/visit_assignments/#{id}/reassign",
         params: { employee_id: employee_id }, headers: auth, as: :json
  end

  it "withdraws the current carer and assigns the new one atomically" do
    reassign(va.id, carer_b.id)
    expect(response).to have_http_status(:created)

    # old assignment withdrawn, new one assigned to carer_b, visit never orphaned
    expect(va.reload.assignment_status).to eq("withdrawn")
    expect(va.lifecycle_state).to eq("cancelled")
    new_va = VisitAssignment.assigned.find_by(visit: visit)
    expect(new_va.employee_id).to eq(carer_b.id)
    expect(response.parsed_body["id"]).to eq(new_va.id)
    expect(response.parsed_body).to have_key("warnings")
  end

  it "writes a single reassignment audit event with from/to carers" do
    expect { reassign(va.id, carer_b.id) }
      .to change { Event.where(event_type: "assignment.reassigned").count }.by(1)
    ev = Event.where(event_type: "assignment.reassigned").last
    expect(ev.payload).to include(
      "from_employee_id" => carer_a.id, "to_employee_id" => carer_b.id
    )
  end

  it "rejects reassigning to the carer already on the visit (422)" do
    reassign(va.id, carer_a.id)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body["error"]).to eq("already_assigned")
    expect(va.reload.assignment_status).to eq("assigned") # untouched
  end

  it "hard-blocks reassigning to a carer already on an overlapping visit (422, nothing changes)" do
    va # ensure the original assignment exists before we measure
    clash = create(:visit, scheduled_start: visit.scheduled_start, scheduled_end: visit.scheduled_end)
    create(:visit_assignment, visit: clash, employee: carer_b)

    expect { reassign(va.id, carer_b.id) }.not_to change(VisitAssignment.assigned, :count)
    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body["error"]).to eq("carer_unavailable")
    expect(response.parsed_body.dig("conflict", "visit_id")).to eq(clash.id)
    expect(va.reload.assignment_status).to eq("assigned") # original carer untouched
  end

  it "still surfaces non-blocking warnings (rest period) when there is no overlap" do
    # A previous visit ending shortly before -> rest_period warning, but no time overlap.
    prev = create(:visit, scheduled_start: visit.scheduled_start - 2.hours, scheduled_end: visit.scheduled_start - 1.hour)
    create(:visit_assignment, visit: prev, employee: carer_b)

    reassign(va.id, carer_b.id)
    expect(response).to have_http_status(:created)
    expect(response.parsed_body["warnings"].map { |w| w["code"] }).to include("rest_period")
  end
end
