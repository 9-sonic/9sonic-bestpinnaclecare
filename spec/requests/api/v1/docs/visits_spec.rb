require "swagger_helper"

RSpec.describe "Visits, clocking & sync", type: :request do
  # ---- Carer: geofenced clock-in ----
  path "/api/v1/staff/visit_assignments/{visit_assignment_id}/clock" do
    parameter name: :visit_assignment_id, in: :path, type: :integer

    post("Clock in/out of a visit (geofenced)") do
      tags "Clocking"
      consumes "application/json"
      produces "application/json"
      security [ bearerAuth: [] ]
      description "Live clock-in/out at the service user's home. Within 150 m -> pass; outside -> 422 too_far; no GPS -> allowed + flagged. Idempotent on client_event_id."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          kind: { type: :string, enum: %w[clock_in clock_out] },
          client_event_id: { type: :string, format: :uuid },
          occurred_at: { type: :string, format: "date-time" },
          lat: { type: :number, nullable: true }, lng: { type: :number, nullable: true },
          accuracy_m: { type: :integer, nullable: true },
          device_fingerprint: { type: :string, format: :uuid, nullable: true }
        },
        required: %w[kind client_event_id occurred_at]
      }

      let(:employee) { create(:employee) }
      let(:su) { create(:service_user, lat: 53.4808, lng: -2.2426, geofence_radius_m: 150) }
      let(:visit) { create(:visit, service_user: su, scheduled_start: 5.minutes.from_now) }
      let(:va) { create(:visit_assignment, visit: visit, employee: employee) }
      let(:visit_assignment_id) { va.id }
      let(:Authorization) { "Bearer #{jwt_for(employee, :employee)}" }

      response(201, "clocked in (geofence pass)") do
        schema type: :object, properties: {
          server_time: { type: :string }, lifecycle_state: { type: :string },
          geofence: { type: :string }, distance_m: { type: :integer, nullable: true }
        }
        let(:body) { { kind: "clock_in", client_event_id: SecureRandom.uuid, occurred_at: Time.current.iso8601, lat: 53.4808, lng: -2.2426 } }
        run_test!
      end

      response(422, "too far from the home") do
        schema type: :object, properties: { error: { type: :string }, distance_m: { type: :integer } }
        let(:body) { { kind: "clock_in", client_event_id: SecureRandom.uuid, occurred_at: Time.current.iso8601, lat: 53.9, lng: -2.9 } }
        run_test!
      end
    end
  end

  # ---- Carer: offline sync ----
  path "/api/v1/staff/sync/events" do
    post("Sync offline clock events (batch, idempotent)") do
      tags "Sync"
      consumes "application/json"
      produces "application/json"
      security [ bearerAuth: [] ]
      description "Uploads the PWA outbox. Each event is idempotent on client_event_id; out-of-range offline clock-ins are recorded + flagged, never dropped."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          events: {
            type: :array,
            items: {
              type: :object,
              properties: {
                visit_assignment_id: { type: :integer }, kind: { type: :string },
                client_event_id: { type: :string }, occurred_at: { type: :string },
                lat: { type: :number, nullable: true }, lng: { type: :number, nullable: true }
              }
            }
          }
        }
      }

      let(:employee) { create(:employee) }
      let(:va) { create(:visit_assignment, employee: employee, visit: create(:visit, service_user: create(:service_user))) }
      let(:Authorization) { "Bearer #{jwt_for(employee, :employee)}" }

      response(200, "ingest results") do
        schema type: :object, properties: {
          results: { type: :array, items: { type: :object, properties: {
            client_event_id: { type: :string }, status: { type: :string }, geofence: { type: :string, nullable: true }
          } } }
        }
        let(:body) { { events: [ { visit_assignment_id: va.id, kind: "clock_in", client_event_id: SecureRandom.uuid, occurred_at: Time.current.iso8601, lat: 53.4808, lng: -2.2426 } ] } }
        run_test!
      end
    end
  end

  path "/api/v1/staff/sync/changes" do
    get("Download visits to cache offline") do
      tags "Sync"
      produces "application/json"
      security [ bearerAuth: [] ]
      parameter name: :since, in: :query, required: false, schema: { type: :string, format: "date-time" }
      description "The carer's non-terminal assigned visits + service-user home coords for the offline geofence."

      let(:employee) { create(:employee) }
      let!(:va) { create(:visit_assignment, employee: employee, visit: create(:visit, service_user: create(:service_user))) }
      let(:since) { nil }
      let(:Authorization) { "Bearer #{jwt_for(employee, :employee)}" }

      response(200, "changeset") do
        schema type: :object, properties: {
          server_time: { type: :string }, cursor: { type: :string },
          visits: { type: :array, items: { "$ref" => "#/components/schemas/VisitAssignment" } }
        }
        run_test!
      end
    end
  end

  # ---- Office: generate + assign ----
  path "/api/v1/admin/visits/generate" do
    post("Generate dated visits from care packages") do
      tags "Rota"
      consumes "application/json"
      produces "application/json"
      security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { from: { type: :string, format: :date }, to: { type: :string, format: :date } }, required: %w[from to]
      }
      let(:admin) { create(:admin) }
      let(:Authorization) { "Bearer #{jwt_for(admin, :admin)}" }
      before { create(:care_package_slot, recurrence: "daily", effective_from: Date.current) }

      response(201, "visits created") do
        schema type: :object, properties: { created: { type: :integer } }
        let(:body) { { from: Date.current.iso8601, to: (Date.current + 2).iso8601 } }
        run_test!
      end
    end
  end

  path "/api/v1/admin/visit_assignments" do
    post("Assign a carer to a visit") do
      tags "Rota"
      consumes "application/json"
      produces "application/json"
      security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { visit_id: { type: :integer }, employee_id: { type: :integer } }, required: %w[visit_id employee_id]
      }
      let(:admin) { create(:admin) }
      let(:Authorization) { "Bearer #{jwt_for(admin, :admin)}" }
      let(:visit) { create(:visit, service_user: create(:service_user)) }
      let(:carer) { create(:employee) }

      response(201, "assigned") do
        schema "$ref" => "#/components/schemas/VisitAssignment"
        let(:body) { { visit_id: visit.id, employee_id: carer.id } }
        run_test!
      end
    end
  end
end
