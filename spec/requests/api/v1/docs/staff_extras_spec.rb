require "swagger_helper"

# Carer PWA routes that existed in the controllers but were missing from the
# spec — the second-pass gap list. Each example runs the real endpoint.
RSpec.describe "Carer PWA — visits, timesheet, tasks, devices, passkeys", type: :request do
  let(:employee) { create(:employee) }
  let(:Authorization) { "Bearer #{jwt_for(employee, :employee)}" }
  let(:service_user) { create(:service_user, lat: 53.4808, lng: -2.2426, geofence_radius_m: 150) }
  let(:assignment) { create(:visit_assignment, employee: employee, visit: create(:visit, service_user: service_user)) }

  path "/api/v1/staff/visits" do
    get("The carer's own visits (defaults to a 7-day window)") do
      tags "Carer"; produces "application/json"; security [ bearerAuth: [] ]
      description "Backs the shift list, clock status and Home screen. Without from/to it returns today .. today+6. Each item is a VisitAssignment with its Visit and nested service_user."
      parameter name: :from, in: :query, required: false, schema: { type: :string, format: :date }
      parameter name: :to,   in: :query, required: false, schema: { type: :string, format: :date }
      let!(:seed) { assignment }
      let(:from) { nil }; let(:to) { nil }
      response(200, "visits") do
        schema type: :array, items: { "$ref" => "#/components/schemas/VisitAssignment" }
        run_test!
      end
    end
  end

  path "/api/v1/staff/timesheet" do
    get("The carer's own timesheet lines") do
      tags "Carer"; produces "application/json"; security [ bearerAuth: [] ]
      description "Attendance lines, newest first. Optional period=<timesheet_period_id> filters to one period."
      parameter name: :period, in: :query, required: false, schema: { type: :integer }
      let(:period) { nil }
      response(200, "lines") { schema type: :array, items: { type: :object }; run_test! }
    end
  end

  path "/api/v1/staff/timesheet_periods" do
    get("Periods the carer has lines in") do
      tags "Carer"; produces "application/json"; security [ bearerAuth: [] ]
      description "So the app can show which week it is viewing and whether it is approved/locked."
      response(200, "periods") do
        schema type: :array, items: { type: :object, properties: {
          id: { type: :integer }, starts_on: { type: :string, format: :date }, ends_on: { type: :string, format: :date },
          status: { type: :string, enum: %w[open approved locked] }
        } }
        run_test!
      end
    end
  end

  path "/api/v1/staff/disputes" do
    post("Raise a dispute on a timesheet line") do
      tags "Carer"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { timesheet_line_id: { type: :integer }, reason: { type: :string } },
        required: %w[timesheet_line_id reason]
      }
      let(:period) { TimesheetPeriod.create!(starts_on: Date.current.beginning_of_week, ends_on: Date.current.end_of_week) }
      let(:line) do
        TimesheetLine.create!(employee: employee, visit_assignment: assignment, timesheet_period: period,
                              scheduled_minutes: 60, worked_minutes: 55, work_date: Date.current)
      end
      response(201, "dispute raised") do
        schema type: :object, properties: { id: { type: :integer }, state: { type: :string }, reason: { type: :string } }
        let(:body) { { timesheet_line_id: line.id, reason: "Clock-out was 25 minutes early." } }
        run_test!
      end
    end
  end

  path "/api/v1/staff/visit_assignments/{id}/tasks" do
    parameter name: :id, in: :path, type: :integer
    patch("Tick off care-plan tasks") do
      tags "Carer"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      description "Marks care-plan tasks done/undone; done stamps completed_at. Returns the full task list."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { tasks: { type: :array, items: {
          type: :object, properties: { id: { type: :integer }, done: { type: :boolean } }
        } } }
      }
      let(:id) { assignment.id }
      response(200, "task list") do
        schema type: :array, items: { type: :object, properties: {
          id: { type: :integer }, label: { type: :string }, done: { type: :boolean }, completed_at: { type: :string, nullable: true }
        } }
        let(:body) { { tasks: [] } }
        run_test!
      end
    end
  end

  path "/api/v1/staff/visit_assignments/{id}/note" do
    parameter name: :id, in: :path, type: :integer
    post("Add a visit note (append-only, idempotent)") do
      tags "Carer"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      description "Notes append; they are never overwritten. Idempotent on client_note_id so a replay after a dead zone cannot create two notes. supersedes_id links a correction to what it replaces."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { body: { type: :string }, client_note_id: { type: :string, format: :uuid }, supersedes_id: { type: :integer } },
        required: %w[body]
      }
      let(:id) { assignment.id }
      response(201, "note created") do
        schema type: :object, properties: {
          id: { type: :integer }, body: { type: :string }, client_note_id: { type: :string }, created_at: { type: :string }
        }
        let(:body) { { body: "Client in good spirits, ate lunch.", client_note_id: SecureRandom.uuid } }
        run_test!
      end
    end
  end

  path "/api/v1/staff/visit_assignments/{visit_assignment_id}/break" do
    parameter name: :visit_assignment_id, in: :path, type: :integer
    post("Start or end a break (via the clock pipeline)") do
      tags "Carer"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      description "Reuses the clock-event pipeline (idempotent, geofenced, audited) so a real break lands on the timesheet, not the scheduled one. Does not change the visit lifecycle. Idempotent on client_event_id."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: {
          phase: { type: :string, enum: %w[start end] }, client_event_id: { type: :string, format: :uuid },
          occurred_at: { type: :string, format: "date-time" }, lat: { type: :number, nullable: true }, lng: { type: :number, nullable: true }, accuracy_m: { type: :integer, nullable: true }
        }, required: %w[phase client_event_id]
      }
      let(:visit_assignment_id) { assignment.id }
      response(201, "break recorded") do
        schema type: :object, properties: { server_time: { type: :string }, kind: { type: :string }, status: { type: :string } }
        let(:body) { { phase: "start", client_event_id: SecureRandom.uuid, occurred_at: Time.current.iso8601, lat: 53.4808, lng: -2.2426 } }
        run_test!
      end
    end
  end

  path "/api/v1/staff/devices/{fingerprint}" do
    parameter name: :fingerprint, in: :path, type: :string
    delete("Deregister a device on sign-out") do
      tags "Carer"; security [ bearerAuth: [] ]
      description "Revokes this device so it stops receiving push. Idempotent — an unknown fingerprint still returns 204."
      let(:fingerprint) { SecureRandom.uuid }
      response(204, "revoked") { run_test! }
    end
  end

  path "/api/v1/staff/webauthn/credentials" do
    get("List the carer's passkeys") do
      tags "Carer"; produces "application/json"; security [ bearerAuth: [] ]
      let!(:credential) { employee.webauthn_credentials.create!(external_id: SecureRandom.uuid, public_key: "cGs=", nickname: "iPhone") }
      response(200, "passkeys") do
        schema type: :array, items: { type: :object, properties: {
          id: { type: :integer }, nickname: { type: :string, nullable: true }, last_used_at: { type: :string, nullable: true }, created_at: { type: :string }
        } }
        run_test!
      end
    end
  end

  path "/api/v1/staff/webauthn/credentials/{id}" do
    parameter name: :id, in: :path, type: :integer
    delete("Revoke a passkey (e.g. a lost phone)") do
      tags "Carer"; security [ bearerAuth: [] ]
      let(:id) { employee.webauthn_credentials.create!(external_id: SecureRandom.uuid, public_key: "cGs=", nickname: "Old phone").id }
      response(204, "revoked") { run_test! }
    end
  end

  path "/api/v1/staff/auth/password" do
    post("Request a password reset link") do
      tags "Auth"; consumes "application/json"; produces "application/json"
      description "Always 202 (never reveals whether the email exists)."
      parameter name: :body, in: :body, schema: { type: :object, properties: { email: { type: :string, format: :email } }, required: %w[email] }
      response(202, "accepted") { let(:body) { { email: employee.email } }; run_test! }
    end

    put("Set a new password with a reset token") do
      tags "Auth"; consumes "application/json"; produces "application/json"
      description "204 on success; 422 { error: 'reset_failed' } if the token is invalid or expired."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { token: { type: :string }, password: { type: :string } }, required: %w[token password]
      }
      response(422, "invalid/expired token") do
        schema "$ref" => "#/components/schemas/Error"
        let(:body) { { token: "not-a-real-token", password: "newsecret123" } }
        run_test!
      end
    end
  end
end
