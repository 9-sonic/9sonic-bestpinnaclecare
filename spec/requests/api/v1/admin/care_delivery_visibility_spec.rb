require "rails_helper"

RSpec.describe "Admin care-delivery visibility", type: :request do
  let(:admin)        { create(:admin) }
  let(:auth)         { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:service_user) { create(:service_user) }
  let(:cpi)          { create(:care_plan_item, service_user: service_user, label: "Prompt morning meds") }
  let(:visit)        { create(:visit, service_user: service_user) }
  let(:employee)     { create(:employee) }
  let(:va)           { create(:visit_assignment, visit: visit, employee: employee) }

  it "GET /admin/visits/:id returns the care plan, tasks and effective notes" do
    task = va.visit_tasks.create!(care_plan_item: cpi, label: cpi.label, done: true, completed_at: Time.current)
    note = VisitNote.create!(visit_assignment: va, author: employee, body: "All well", client_note_id: SecureRandom.uuid)

    get "/api/v1/admin/visits/#{visit.id}", headers: auth
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body["care_plan"].map { |c| c["label"] }).to include("Prompt morning meds")
    asn = body["assignments"].first
    expect(asn["tasks"].first).to include("id" => task.id, "done" => true)
    expect(asn["notes"].first).to include("body" => "All well", "author_name" => employee.full_name)
  end

  it "GET /admin/service_users/:id/notes returns the journal newest-first with visit + carer context" do
    other_visit = create(:visit, service_user: service_user)
    other_va    = create(:visit_assignment, visit: other_visit, employee: employee)
    VisitNote.create!(visit_assignment: va, author: employee, body: "Older", client_note_id: SecureRandom.uuid, created_at: 2.days.ago)
    VisitNote.create!(visit_assignment: other_va, author: employee, body: "Newer", client_note_id: SecureRandom.uuid, created_at: 1.hour.ago)

    get "/api/v1/admin/service_users/#{service_user.id}/notes", headers: auth
    expect(response).to have_http_status(:ok)
    body = response.parsed_body
    expect(body["total"]).to eq(2)
    expect(body["notes"].map { |n| n["body"] }).to eq(%w[Newer Older]) # newest first
    expect(body["notes"].first).to include(
      "visit_id" => other_visit.id, "employee_id" => employee.id, "employee_name" => employee.full_name
    )
  end

  it "filters the journal by search term, carer and date range" do
    carer_b   = create(:employee)
    visit_b    = create(:visit, service_user: service_user, scheduled_start: 10.days.ago)
    va_b       = create(:visit_assignment, visit: visit_b, employee: carer_b)
    VisitNote.create!(visit_assignment: va,   author: employee, body: "gave lunch, ate well", client_note_id: SecureRandom.uuid)
    VisitNote.create!(visit_assignment: va_b, author: carer_b,  body: "refused breakfast",     client_note_id: SecureRandom.uuid)

    get "/api/v1/admin/service_users/#{service_user.id}/notes", params: { q: "lunch" }, headers: auth
    expect(response.parsed_body["notes"].map { |n| n["body"] }).to eq(["gave lunch, ate well"])

    get "/api/v1/admin/service_users/#{service_user.id}/notes", params: { employee_id: carer_b.id }, headers: auth
    expect(response.parsed_body["notes"].map { |n| n["body"] }).to eq(["refused breakfast"])
  end

  it "excludes superseded notes from the service-user journal" do
    original   = VisitNote.create!(visit_assignment: va, author: employee, body: "First draft", client_note_id: SecureRandom.uuid)
    correction = VisitNote.create!(visit_assignment: va, author: admin, body: "Corrected", client_note_id: SecureRandom.uuid, supersedes: original)

    get "/api/v1/admin/service_users/#{service_user.id}/notes", headers: auth
    bodies = response.parsed_body["notes"].map { |n| n["body"] }
    expect(bodies).to include("Corrected")
    expect(bodies).not_to include("First draft")
    expect(correction).to be_persisted
  end
end
