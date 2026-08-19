require "swagger_helper"

RSpec.describe "Carer PWA + auth", type: :request do
  let(:employee) { create(:employee, contracted_hours_per_week: 37.5) }
  let(:Authorization) { "Bearer #{jwt_for(employee, :employee)}" }

  path "/api/v1/auth/refresh" do
    post("Rotate a refresh token") do
      tags "Auth"; consumes "application/json"; produces "application/json"
      description "Exchanges a refresh token for a fresh access token + a new refresh token (the old one is revoked). Reusing a revoked token nukes the chain."
      parameter name: :body, in: :body, schema: { type: :object, properties: { refresh_token: { type: :string } }, required: %w[refresh_token] }
      response(200, "rotated") do
        schema type: :object, properties: {
          access: { type: :string }, access_expires_at: { type: :string }, refresh_token: { type: :string },
          employee: { "$ref" => "#/components/schemas/Employee" }
        }
        let(:body) { { refresh_token: Auth::RefreshTokens.issue(resource: employee, scope: :employee)[:refresh_token] } }
        run_test!
      end
      response(401, "invalid/expired") do
        let(:body) { { refresh_token: "0.nope" } }
        run_test!
      end
    end
  end

  path "/api/v1/staff/me" do
    get("Current carer (private fields + pay)") do
      tags "Carer"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "profile") { schema "$ref" => "#/components/schemas/Employee"; run_test! }
    end
    patch("Edit own profile") do
      tags "Carer"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      description "Name, phone and emergency contact. Email + employee_reference stay office-controlled."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: {
          first_name: { type: :string }, last_name: { type: :string }, phone: { type: :string },
          emergency_contact_name: { type: :string }, emergency_contact_phone: { type: :string }
        }
      }
      response(200, "updated") { schema "$ref" => "#/components/schemas/Employee"; let(:body) { { phone: "07700 900000" } }; run_test! }
    end
  end

  path "/api/v1/staff/availability" do
    get("Read availability") do
      tags "Carer"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "weekly pattern") { run_test! }
    end
    put("Replace availability") do
      tags "Carer"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { entries: { type: :array, items: {
          type: :object, properties: { weekday: { type: :integer }, slot: { type: :string, enum: %w[morning afternoon evening night] }, available: { type: :boolean } }
        } } }
      }
      response(200, "saved") { let(:body) { { entries: [ { weekday: 0, slot: "morning", available: true } ] } }; run_test! }
    end
  end

  path "/api/v1/staff/visit_assignments/{id}" do
    parameter name: :id, in: :path, type: :integer
    get("Visit detail (care plan + tasks + notes)") do
      tags "Carer"; produces "application/json"; security [ bearerAuth: [] ]
      let(:id) { create(:visit_assignment, employee: employee, visit: create(:visit, service_user: create(:service_user))).id }
      response(200, "detail") do
        schema allOf: [ { "$ref" => "#/components/schemas/VisitAssignment" }, { type: :object, properties: {
          care_plan: { type: :array, items: { type: :object } }, tasks: { type: :array, items: { type: :object } }, notes: { type: :array, items: { type: :object } }
        } } ]
        run_test!
      end
    end
  end

  path "/api/v1/staff/mileage" do
    get("List own mileage claims") do
      tags "Carer"; produces "application/json"; security [ bearerAuth: [] ]
      description "The carer's own claims, newest first. Optional from/to (inclusive) filter on travel_date."
      parameter name: :from, in: :query, required: false, schema: { type: :string, format: :date }
      parameter name: :to,   in: :query, required: false, schema: { type: :string, format: :date }
      response(200, "claims") do
        schema type: :array, items: { type: :object, properties: {
          id: { type: :integer }, travel_date: { type: :string, format: :date }, miles: { type: :number },
          from_label: { type: :string, nullable: true }, to_label: { type: :string, nullable: true },
          source: { type: :string }, state: { type: :string }, visit_assignment_id: { type: :integer, nullable: true }
        } }
        let(:from) { nil }; let(:to) { nil }
        run_test!
      end
    end

    post("Claim mileage") do
      tags "Carer"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { visit_assignment_id: { type: :integer }, travel_date: { type: :string, format: :date }, miles: { type: :number }, from_label: { type: :string }, to_label: { type: :string } },
        required: %w[travel_date miles]
      }
      response(201, "claimed") { let(:body) { { travel_date: Date.current.iso8601, miles: 4.2 } }; run_test! }
    end
  end

  path "/api/v1/staff/summary" do
    get("Home/Overview totals") do
      tags "Carer"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :from, in: :query, required: false, schema: { type: :string, format: :date }
      parameter name: :to,   in: :query, required: false, schema: { type: :string, format: :date }
      response(200, "summary") do
        schema type: :object, properties: {
          hours_worked_minutes: { type: :integer }, scheduled_minutes: { type: :integer, nullable: true },
          visits_count: { type: :integer }, clients_count: { type: :integer }, miles: { type: :number },
          by_weekday: { type: :object }
        }
        let(:from) { nil }; let(:to) { nil }
        run_test!
      end
    end
  end

  path "/api/v1/staff/devices" do
    post("Register this device (web push)") do
      tags "Carer"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { fingerprint: { type: :string, format: :uuid }, platform: { type: :string }, app_version: { type: :string }, push_subscription: { type: :object } },
        required: %w[fingerprint]
      }
      response(201, "registered") { let(:body) { { fingerprint: SecureRandom.uuid, platform: "iOS" } }; run_test! }
    end
  end

  path "/api/v1/notifications/seen_all" do
    post("Mark all notifications read") do
      tags "Notifications"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "count updated") { schema type: :object, properties: { updated: { type: :integer } }; run_test! }
    end
  end

  path "/api/v1/conversations" do
    get("List conversations (names + unread + preview)") do
      tags "Chat"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "conversations") { run_test! }
    end

    post("Open or create a conversation") do
      tags "Chat"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      description "kind: direct (dedupes on the two people), group or channel (title + participants). Each participant is { type: 'Admin'|'Employee', id }."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: {
          kind: { type: :string, enum: %w[direct group channel] },
          title: { type: :string, description: "Required for group/channel." },
          participant: { type: :object, properties: { type: { type: :string }, id: { type: :integer } }, description: "For kind=direct." },
          participants: { type: :array, items: { type: :object, properties: { type: { type: :string }, id: { type: :integer } } }, description: "For group/channel." }
        }, required: %w[kind]
      }
      let(:other) { create(:admin) }
      response(201, "conversation") { let(:body) { { kind: "direct", participant: { type: "Admin", id: other.id } } }; run_test! }
    end
  end
end
