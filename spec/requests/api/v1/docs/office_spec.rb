require "swagger_helper"

RSpec.describe "Office (admin)", type: :request do
  let(:manager) { create(:admin, role: :registered_manager) }
  let(:Authorization) { "Bearer #{jwt_for(manager, :admin)}" }
  let(:su) { create(:service_user) }

  # ---- Service users + care plan ----
  path "/api/v1/admin/service_users" do
    get("List service users") do
      tags "Office — Service Users"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "list") { schema type: :array, items: { "$ref" => "#/components/schemas/ServiceUser" }; run_test! }
    end
    post("Create a service user") do
      tags "Office — Service Users"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      description "Address is geocoded to lat/lng unless coordinates are supplied."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: {
          first_name: { type: :string }, last_name: { type: :string }, address_line1: { type: :string },
          city: { type: :string }, postcode: { type: :string }, lat: { type: :number }, lng: { type: :number },
          geofence_radius_m: { type: :integer }, access_notes: { type: :string }
        }, required: %w[first_name last_name]
      }
      response(201, "created") { schema "$ref" => "#/components/schemas/ServiceUser"; let(:body) { { first_name: "Ada", last_name: "Smith", lat: 53.48, lng: -2.24 } }; run_test! }
    end
  end

  path "/api/v1/admin/service_users/{id}" do
    parameter name: :id, in: :path, type: :integer
    get("Show a service user") do
      tags "Office — Service Users"; produces "application/json"; security [ bearerAuth: [] ]
      let(:id) { su.id }
      response(200, "service user") { schema "$ref" => "#/components/schemas/ServiceUser"; run_test! }
    end
    patch("Update a service user") do
      tags "Office — Service Users"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: { type: :object, properties: { phone: { type: :string }, access_notes: { type: :string } } }
      let(:id) { su.id }
      response(200, "updated") { schema "$ref" => "#/components/schemas/ServiceUser"; let(:body) { { phone: "0161 555 0100" } }; run_test! }
    end
  end

  path "/api/v1/admin/service_users/{service_user_id}/care_plan_items" do
    parameter name: :service_user_id, in: :path, type: :integer
    get("List care plan items") do
      tags "Office — Care Plan"; produces "application/json"; security [ bearerAuth: [] ]
      let(:service_user_id) { su.id }
      response(200, "items") { run_test! }
    end
    post("Add a care plan item") do
      tags "Office — Care Plan"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { category: { type: :string }, label: { type: :string }, detail: { type: :string }, position: { type: :integer } },
        required: %w[category label]
      }
      let(:service_user_id) { su.id }
      response(201, "created") { let(:body) { { category: "medication", label: "8am tablets" } }; run_test! }
    end
  end

  # ---- Care packages ----
  path "/api/v1/admin/care_package_slots" do
    get("List care packages (optionally filtered by service user)") do
      tags "Office — Care Packages"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :service_user_id, in: :query, required: false, schema: { type: :integer }
      let(:service_user_id) { nil }
      response(200, "slots") { run_test! }
    end

    post("Create a recurring call") do
      tags "Office — Care Packages"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: {
          service_user_id: { type: :integer }, name: { type: :string }, start_time: { type: :string }, end_time: { type: :string },
          recurrence: { type: :string, description: "daily, or day list e.g. mon,wed,fri" }, staff_required: { type: :integer }, effective_from: { type: :string, format: :date }
        }, required: %w[service_user_id name start_time end_time recurrence effective_from]
      }
      response(201, "created") do
        let(:body) { { service_user_id: su.id, name: "Morning", start_time: "08:00", end_time: "08:45", recurrence: "daily", effective_from: Date.current.iso8601 } }
        run_test!
      end
    end
  end

  # ---- Visits / rota ----
  path "/api/v1/admin/visits" do
    get("Rota (visits in a window)") do
      tags "Office — Rota"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :from, in: :query, required: false, schema: { type: :string, format: :date }
      parameter name: :to,   in: :query, required: false, schema: { type: :string, format: :date }
      let(:from) { nil }; let(:to) { nil }
      response(200, "visits") { schema type: :array, items: { "$ref" => "#/components/schemas/Visit" }; run_test! }
    end
    post("Create an ad-hoc visit") do
      tags "Office — Rota"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { service_user_id: { type: :integer }, scheduled_start: { type: :string, format: "date-time" }, scheduled_end: { type: :string, format: "date-time" } },
        required: %w[service_user_id scheduled_start scheduled_end]
      }
      response(201, "created") do
        schema "$ref" => "#/components/schemas/Visit"
        let(:body) { { service_user_id: su.id, scheduled_start: 1.hour.from_now.iso8601, scheduled_end: 2.hours.from_now.iso8601 } }
        run_test!
      end
    end
  end

  path "/api/v1/admin/visits/generate" do
    post("Generate visits from care packages") do
      tags "Office — Rota"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: { type: :object, properties: { from: { type: :string, format: :date }, to: { type: :string, format: :date } }, required: %w[from to] }
      before { create(:care_package_slot, service_user: su, recurrence: "daily", effective_from: Date.current) }
      response(201, "created count") { schema type: :object, properties: { created: { type: :integer } }; let(:body) { { from: Date.current.iso8601, to: Date.current.iso8601 } }; run_test! }
    end
  end

  path "/api/v1/admin/visits/{id}" do
    parameter name: :id, in: :path, type: :integer
    patch("Retime a visit (audited; refused once clocked in)") do
      tags "Office — Rota"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      description "Reschedule a visit before it happens. A reason is required and appended to the audit trail (visit.rescheduled). 422 { error: 'visit_started' } once a carer has clocked in — the original record is never rewritten; 422 { error: 'reason_required' } without a reason."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: {
          scheduled_start: { type: :string, format: "date-time" }, scheduled_end: { type: :string, format: "date-time" },
          notes: { type: :string }, reason: { type: :string }
        }, required: %w[reason]
      }
      let(:id) { create(:visit, service_user: su, scheduled_start: 1.day.from_now.change(hour: 9), scheduled_end: 1.day.from_now.change(hour: 10)).id }
      response(200, "retimed") do
        schema "$ref" => "#/components/schemas/Visit"
        let(:body) { { scheduled_start: 1.day.from_now.change(hour: 11).iso8601, scheduled_end: 1.day.from_now.change(hour: 12).iso8601, reason: "Client asked for a later call" } }
        run_test!
      end
    end
  end

  path "/api/v1/admin/visits/{id}/publish" do
    parameter name: :id, in: :path, type: :integer
    post("Publish a visit") do
      tags "Office — Rota"; produces "application/json"; security [ bearerAuth: [] ]
      let(:id) { create(:visit, service_user: su).id }
      response(200, "published") { schema "$ref" => "#/components/schemas/Visit"; run_test! }
      response(422, "start is in the past") do
        schema "$ref" => "#/components/schemas/Error"
        let(:id) { create(:visit, service_user: su, scheduled_start: 2.hours.ago, scheduled_end: 1.hour.ago).id }
        run_test!
      end
    end
  end

  path "/api/v1/admin/visit_assignments" do
    post("Assign a carer (returns validation warnings)") do
      tags "Office — Rota"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: { type: :object, properties: { visit_id: { type: :integer }, employee_id: { type: :integer } }, required: %w[visit_id employee_id] }
      response(201, "assigned") do
        let(:body) { { visit_id: create(:visit, service_user: su).id, employee_id: create(:employee).id } }
        run_test!
      end
    end
  end

  path "/api/v1/admin/rota_copies" do
    post("Copy a week of visits to another week") do
      tags "Office — Rota"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: { type: :object, properties: { from_week_start: { type: :string, format: :date }, to_week_start: { type: :string, format: :date } }, required: %w[from_week_start to_week_start] }
      response(201, "copied count") { let(:body) { { from_week_start: Date.current.beginning_of_week.iso8601, to_week_start: (Date.current.beginning_of_week + 7).iso8601 } }; run_test! }
    end
  end

  # ---- Monitoring ----
  path "/api/v1/admin/dashboard" do
    get("Dashboard headline counts") do
      tags "Office — Monitoring"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "counts") { run_test! }
    end
  end
  path "/api/v1/admin/live_board" do
    get("Live board — today's visits + states") do
      tags "Office — Monitoring"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "board") { run_test! }
    end
  end
  path "/api/v1/admin/exceptions" do
    get("Exceptions queue (pending review + open alerts)") do
      tags "Office — Monitoring"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "queue") { run_test! }
    end
  end
  path "/api/v1/admin/alerts" do
    get("Open alerts") do
      tags "Office — Monitoring"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "alerts") { run_test! }
    end
  end

  path "/api/v1/admin/clock_corrections" do
    post("Manual clock correction (append-only, reason required)") do
      tags "Office — Monitoring"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { visit_assignment_id: { type: :integer }, kind: { type: :string }, occurred_at: { type: :string }, reason: { type: :string }, corrects_id: { type: :integer } },
        required: %w[visit_assignment_id kind occurred_at reason]
      }
      response(201, "recorded") do
        let(:body) do
          va = create(:visit_assignment, visit: create(:visit, service_user: su), lifecycle_state: "pending_review")
          { visit_assignment_id: va.id, kind: "clock_out", occurred_at: Time.current.iso8601, reason: "carer forgot to clock out" }
        end
        run_test!
      end
    end
  end

  # ---- Timesheets ----
  path "/api/v1/admin/timesheet_periods" do
    get("List attendance periods (newest first)") do
      tags "Office — Timesheets"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "periods") do
        schema type: :array, items: { type: :object, properties: {
          id: { type: :integer }, starts_on: { type: :string, format: :date }, ends_on: { type: :string, format: :date }, status: { type: :string }
        } }
        run_test!
      end
    end

    post("Build/refresh an attendance period") do
      tags "Office — Timesheets"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: { type: :object, properties: { starts_on: { type: :string, format: :date } }, required: %w[starts_on] }
      response(201, "period + lines") { let(:body) { { starts_on: Date.current.beginning_of_week.iso8601 } }; run_test! }
    end
  end

  path "/api/v1/admin/employees" do
    get("List carers (with clocking stats)") do
      tags "Office — People"; produces "application/json"; security [ bearerAuth: [] ]
      description "Each carer merged with Staff::Stats — hours this week, punctuality, dominant capture method. Pay fields only for finance / registered manager."
      response(200, "carers") { schema type: :array, items: { "$ref" => "#/components/schemas/Employee" }; run_test! }
    end

    post("Invite a carer") do
      tags "Office — People"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: { type: :object, properties: { email: { type: :string }, first_name: { type: :string }, last_name: { type: :string } }, required: %w[email first_name last_name] }
      response(201, "invited") { schema "$ref" => "#/components/schemas/Employee"; let(:body) { { email: "new@bpc.test", first_name: "New", last_name: "Carer" } }; run_test! }
    end
  end

  path "/api/v1/admin/settings" do
    get("Read provider settings") do
      tags "Office — Settings"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "settings") { run_test! }
    end
    patch("Update provider settings") do
      tags "Office — Settings"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: { type: :object, properties: { geofence_radius_m: { type: :integer }, missed_threshold_minutes: { type: :integer } } }
      response(200, "updated") { let(:body) { { geofence_radius_m: 200 } }; run_test! }
    end
  end
end
