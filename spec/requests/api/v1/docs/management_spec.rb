require "swagger_helper"

# OpenAPI documentation for the management endpoints added for the manager
# console: audit trail, reports, cover and carer requests. rswag runs these as
# real request specs and regenerates swagger/v1/swagger.yaml.
RSpec.describe "Office — management", type: :request do
  let(:manager)       { create(:admin, role: :registered_manager) }
  let(:Authorization) { "Bearer #{jwt_for(manager, :admin)}" }
  let(:su)            { create(:service_user) }
  let(:employee)      { create(:employee) }
  let(:open_visit)    { create(:visit, service_user: su, status: "published", scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now) }

  path "/api/v1/admin/audit" do
    get("Audit trail (append-only event log)") do
      tags "Office — Audit"; produces "application/json"; security [ bearerAuth: [] ]
      description "Who did what, when and why. Read-only; entries are never altered."
      parameter name: :event_type,     in: :query, type: :string,  required: false
      parameter name: :aggregate_type, in: :query, type: :string,  required: false
      parameter name: :before,         in: :query, type: :string,  required: false, description: "ISO8601 cursor"
      parameter name: :limit,          in: :query, type: :integer, required: false
      response(200, "events, newest first") { run_test! }
    end
  end

  path "/api/v1/admin/reports" do
    get("Clocking performance aggregates") do
      tags "Office — Reports"; produces "application/json"; security [ bearerAuth: [] ]
      description "Attendance, punctuality, hours and exceptions over a date range. Defaults to the last 7 days."
      parameter name: :from, in: :query, type: :string, required: false, description: "ISO8601"
      parameter name: :to,   in: :query, type: :string, required: false, description: "ISO8601"
      response(200, "aggregates") { run_test! }
    end
  end

  path "/api/v1/admin/cover" do
    get("Cover board — unfilled visits and their offers") do
      tags "Office — Cover"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "open shifts + counts") { run_test! }
    end
  end

  path "/api/v1/admin/cover_offers" do
    post("Offer an unfilled visit to a carer") do
      tags "Office — Cover"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { visit_id: { type: :integer }, employee_id: { type: :integer }, note: { type: :string } },
        required: %w[visit_id employee_id]
      }
      response(201, "offer created") { let(:body) { { visit_id: open_visit.id, employee_id: employee.id } }; run_test! }
    end
  end

  path "/api/v1/admin/cover_offers/{id}/accept" do
    parameter name: :id, in: :path, type: :integer
    post("Accept an offer — fills the visit and creates the assignment") do
      tags "Office — Cover"; produces "application/json"; security [ bearerAuth: [] ]
      let(:id) { CoverOffer.create!(visit: open_visit, employee: employee, state: "pending").id }
      response(200, "accepted") { run_test! }
    end
  end

  path "/api/v1/admin/cover_offers/{id}/decline" do
    parameter name: :id, in: :path, type: :integer
    post("Decline an offer") do
      tags "Office — Cover"; produces "application/json"; security [ bearerAuth: [] ]
      let(:id) { CoverOffer.create!(visit: open_visit, employee: employee, state: "pending").id }
      response(200, "declined") { run_test! }
    end
  end

  path "/api/v1/admin/requests" do
    get("Carer requests queue (pending first)") do
      tags "Office — Requests"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :kind,  in: :query, type: :string, required: false, description: "swap|drop|overtime|availability|leave"
      parameter name: :state, in: :query, type: :string, required: false
      response(200, "requests") { run_test! }
    end
  end

  path "/api/v1/admin/requests/{id}/approve" do
    parameter name: :id, in: :path, type: :integer
    post("Approve a carer request") do
      tags "Office — Requests"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, required: false, schema: { type: :object, properties: { note: { type: :string } } }
      let(:id) { CarerRequest.create!(employee: employee, kind: "swap", summary: "swap Friday").id }
      let(:body) { { note: "cover arranged" } }
      response(200, "approved") { run_test! }
    end
  end

  path "/api/v1/admin/requests/{id}/decline" do
    parameter name: :id, in: :path, type: :integer
    post("Decline a carer request") do
      tags "Office — Requests"; produces "application/json"; security [ bearerAuth: [] ]
      let(:id) { CarerRequest.create!(employee: employee, kind: "swap", summary: "swap Friday").id }
      response(200, "declined") { run_test! }
    end
  end

  path "/api/v1/staff/requests" do
    post("Carer raises a request") do
      tags "Carer — Requests"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { kind: { type: :string, enum: %w[swap drop overtime availability leave] }, summary: { type: :string }, detail: { type: :string } },
        required: %w[kind summary]
      }
      let(:Authorization) { "Bearer #{jwt_for(employee, :employee)}" }
      let(:body) { { kind: "overtime", summary: "Available for weekend hours" } }
      response(201, "created") { run_test! }
    end
  end
end
