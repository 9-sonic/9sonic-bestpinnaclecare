require "rails_helper"

RSpec.describe "Per-carer timesheet approval", type: :request do
  let(:manager) { create(:admin, role: :registered_manager) }
  let(:auth)    { { "Authorization" => "Bearer #{jwt_for(manager, :admin)}" } }
  let(:su)      { create(:service_user) }
  let(:period)  { TimesheetPeriod.create!(starts_on: Date.current.beginning_of_week, ends_on: Date.current.end_of_week) }
  let(:carer_a) { create(:employee) }
  let(:carer_b) { create(:employee) }

  # A completed visit + timesheet line for a carer in the period.
  def line_for(carer, state: :completed, flags: [])
    visit = create(:visit, service_user: su, scheduled_start: 2.hours.ago, scheduled_end: 1.hour.ago)
    va = create(:visit_assignment, visit: visit, employee: carer, lifecycle_state: state)
    period.timesheet_lines.create!(
      employee: carer, visit_assignment: va, work_date: Date.current,
      scheduled_minutes: 60, worked_minutes: 60, break_minutes: 0, flags: flags
    )
  end

  def approve_carer(employee)
    post "/api/v1/admin/timesheet_periods/#{period.id}/approve_carer",
         params: { employee_id: employee.id }, headers: auth, as: :json
  end

  it "approves only the named carer's lines, leaving others untouched" do
    a = line_for(carer_a)
    b = line_for(carer_b)

    approve_carer(carer_a)
    expect(response).to have_http_status(:ok)
    expect(response.parsed_body["approved_count"]).to eq(1)
    expect(a.reload.approved_at).to be_present
    expect(a.approved_by).to eq(manager)
    expect(b.reload.approved_at).to be_nil          # other carer untouched
    expect(period.reload.status).to eq("open")      # period stays open
  end

  it "records a carer-approval audit event" do
    line_for(carer_a)
    expect { approve_carer(carer_a) }
      .to change { Event.where(event_type: "timesheet.carer_approved").count }.by(1)
  end

  it "is idempotent — re-approving approves nothing new" do
    line_for(carer_a)
    approve_carer(carer_a)
    approve_carer(carer_a)
    expect(response.parsed_body["approved_count"]).to eq(0)
  end

  it "refuses when a carer's line is still pending_review" do
    line_for(carer_a, state: :pending_review)
    approve_carer(carer_a)
    expect(response).to have_http_status(422)
    expect(response.parsed_body["error"]).to eq("unconfirmed_lines")
  end

  it "refuses on a locked period" do
    line_for(carer_a)
    period.update!(status: "locked", locked_at: Time.current)
    approve_carer(carer_a)
    expect(response).to have_http_status(422)
    expect(response.parsed_body["error"]).to eq("period_locked")
  end

  it "shows the per-carer approval rollup on the period" do
    line_for(carer_a)
    line_for(carer_b)
    approve_carer(carer_a)

    get "/api/v1/admin/timesheet_periods/#{period.id}", headers: auth
    carers = response.parsed_body["carers"].index_by { |c| c["employee_id"] }
    expect(carers[carer_a.id]).to include("approved" => true, "approved_count" => 1)
    expect(carers[carer_b.id]).to include("approved" => false, "approved_count" => 0)
  end
end
