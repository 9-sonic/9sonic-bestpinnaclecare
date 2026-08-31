require "rails_helper"

# A carer must be told when a shift becomes theirs — otherwise, for an
# offline-first app, they only learn of it by opening the rota. Publishing an
# assigned draft, and assigning/reassigning onto an already-published visit, each
# notify the carer on the bell AND web push (Notifications::ShiftAssigned).
RSpec.describe "Carer shift-assigned notifications", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:carer) { create(:employee) }
  let(:su)    { create(:service_user) }

  def visit(status: :draft)
    create(:visit, service_user: su, status: status,
                   scheduled_start: 2.days.from_now.change(hour: 9), scheduled_end: 2.days.from_now.change(hour: 10))
  end

  def carer_notifications
    Notification.where(recipient: carer, notification_type: "shift_assigned")
  end

  it "notifies the assigned carer on the bell and push when a draft is published" do
    v = visit(status: :draft)
    create(:visit_assignment, visit: v, employee: carer, assignment_status: "assigned", lifecycle_state: :scheduled)

    expect {
      post "/api/v1/admin/visits/#{v.id}/publish", headers: auth, as: :json
    }.to change { carer_notifications.count }.by(2) # in_app + push

    expect(response).to have_http_status(:ok)
    expect(carer_notifications.pluck(:channel)).to match_array(%w[in_app push])
    expect(carer_notifications.first.title).to eq("New shift")
  end

  it "does NOT re-notify when an already-published visit is published again" do
    v = visit(status: :published)
    create(:visit_assignment, visit: v, employee: carer, assignment_status: "assigned", lifecycle_state: :scheduled)

    expect {
      post "/api/v1/admin/visits/#{v.id}/publish", headers: auth, as: :json
    }.not_to change { carer_notifications.count }
  end

  it "does NOT notify a carer assigned to a DRAFT (announced later at publish)" do
    v = visit(status: :draft)
    expect {
      post "/api/v1/admin/visit_assignments", params: { visit_id: v.id, employee_id: carer.id }, headers: auth, as: :json
    }.not_to change { carer_notifications.count }
  end

  it "notifies immediately when a carer is assigned to an ALREADY-published visit" do
    v = visit(status: :published)
    expect {
      post "/api/v1/admin/visit_assignments", params: { visit_id: v.id, employee_id: carer.id }, headers: auth, as: :json
    }.to change { carer_notifications.count }.by(2)
  end

  it "notifies the NEW carer on reassignment of a published visit" do
    v = visit(status: :published)
    old = create(:employee)
    va = create(:visit_assignment, visit: v, employee: old, assignment_status: "assigned", lifecycle_state: :scheduled)

    expect {
      post "/api/v1/admin/visit_assignments/#{va.id}/reassign", params: { employee_id: carer.id }, headers: auth, as: :json
    }.to change { carer_notifications.count }.by(2)
  end
end
