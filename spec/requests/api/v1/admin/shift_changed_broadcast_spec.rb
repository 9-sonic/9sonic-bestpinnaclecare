require "rails_helper"

# When the office changes a carer's rota, the carer's PWA calendar should update
# live — the server broadcasts a lightweight { type: "shift" } ping to the
# carer's inbox stream ("inbox:Employee:<id>"), which the PWA refetches on. This
# proves the ping fires on every change: publish, assign, reassign, withdraw,
# cancel. (The bell/notification path is covered separately.)
RSpec.describe "Carer rota live-update broadcast", type: :request do
  include ActionCable::TestHelper

  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:carer) { create(:employee) }
  let(:su)    { create(:service_user) }

  def stream_for(employee) = "inbox:Employee:#{employee.id}"

  def visit(status: :draft)
    create(:visit, service_user: su, status: status,
                   scheduled_start: 2.days.from_now.change(hour: 9), scheduled_end: 2.days.from_now.change(hour: 10))
  end

  it "broadcasts a shift ping to the carer when a draft they're on is published" do
    v = visit(status: :draft)
    create(:visit_assignment, visit: v, employee: carer, assignment_status: "assigned", lifecycle_state: :scheduled)

    expect {
      post "/api/v1/admin/visits/#{v.id}/publish", headers: auth, as: :json
    }.to have_broadcasted_to(stream_for(carer)).with(hash_including("type" => "shift"))
  end

  it "broadcasts to the carer when assigned to a visit" do
    v = visit(status: :published)
    expect {
      post "/api/v1/admin/visit_assignments", params: { visit_id: v.id, employee_id: carer.id }, headers: auth, as: :json
    }.to have_broadcasted_to(stream_for(carer)).with(hash_including("type" => "shift"))
  end

  it "broadcasts to BOTH the old and new carer on reassignment" do
    v = visit(status: :published)
    old = create(:employee)
    va = create(:visit_assignment, visit: v, employee: old, assignment_status: "assigned", lifecycle_state: :scheduled)

    expect {
      post "/api/v1/admin/visit_assignments/#{va.id}/reassign", params: { employee_id: carer.id }, headers: auth, as: :json
    }.to have_broadcasted_to(stream_for(carer)).with(hash_including("type" => "shift"))
      .and have_broadcasted_to(stream_for(old)).with(hash_including("type" => "shift"))
  end

  it "broadcasts to the carer when their assignment is withdrawn" do
    v = visit(status: :published)
    va = create(:visit_assignment, visit: v, employee: carer, assignment_status: "assigned", lifecycle_state: :scheduled)

    expect {
      delete "/api/v1/admin/visit_assignments/#{va.id}", headers: auth, as: :json
    }.to have_broadcasted_to(stream_for(carer)).with(hash_including("type" => "shift"))
  end

  it "broadcasts to the assigned carer when the visit is cancelled" do
    v = visit(status: :published)
    create(:visit_assignment, visit: v, employee: carer, assignment_status: "assigned", lifecycle_state: :scheduled)

    expect {
      post "/api/v1/admin/visits/#{v.id}/cancel", params: { reason: "Client in hospital" }, headers: auth, as: :json
    }.to have_broadcasted_to(stream_for(carer)).with(hash_including("type" => "shift"))
  end
end
