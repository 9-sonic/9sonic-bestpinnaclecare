require "swagger_helper"

# Admin (office) routes that existed in the controllers but were missing from the
# spec — the admin-side equivalent of the PWA gap sweep. Documented from the
# registered manager's seat (passes every role gate). Each example runs the real
# endpoint, so the spec cannot drift from the controllers again.
RSpec.describe "Office (admin) — undocumented routes", type: :request do
  let(:manager)       { create(:admin, role: :registered_manager) }
  let(:Authorization) { "Bearer #{jwt_for(manager, :admin)}" }
  let(:su)            { create(:service_user) }
  let(:employee)      { create(:employee) }
  let(:assignment)    { create(:visit_assignment, employee: employee, visit: create(:visit, service_user: su)) }

  # ---- Office users (admins) ----
  path "/api/v1/admin/admins" do
    get("List office users") do
      tags "Office — People"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :page,     in: :query, required: false, schema: { type: :integer }
      parameter name: :per_page, in: :query, required: false, schema: { type: :integer }
      response(200, "admins") { schema PagedSchema.of("#/components/schemas/Admin"); run_test! }
    end

    post("Invite an office user (registered manager only)") do
      tags "Office — People"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: {
          email: { type: :string }, first_name: { type: :string }, last_name: { type: :string },
          role: { type: :string, enum: %w[registered_manager manager coordinator auditor] }, phone: { type: :string }
        }, required: %w[email first_name last_name role]
      }
      response(201, "invited") do
        schema "$ref" => "#/components/schemas/Admin"
        let(:body) { { email: "coord@bpc.test", first_name: "Cara", last_name: "Coord", role: "coordinator" } }
        run_test!
      end
    end
  end

  path "/api/v1/admin/admins/{id}" do
    parameter name: :id, in: :path, type: :integer
    get("Show an office user") do
      tags "Office — People"; produces "application/json"; security [ bearerAuth: [] ]
      let(:id) { create(:admin, role: :coordinator).id }
      response(200, "admin") { schema "$ref" => "#/components/schemas/Admin"; run_test! }
    end

    patch("Update an office user (registered manager only)") do
      tags "Office — People"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: { type: :object, properties: { phone: { type: :string }, role: { type: :string }, active: { type: :boolean } } }
      let(:id) { create(:admin, role: :coordinator).id }
      response(200, "updated") { schema "$ref" => "#/components/schemas/Admin"; let(:body) { { phone: "0161 555 0111" } }; run_test! }
    end
  end

  # ---- Carer detail + availability ----
  path "/api/v1/admin/employees/{id}" do
    parameter name: :id, in: :path, type: :integer
    get("Show a carer") do
      tags "Office — People"; produces "application/json"; security [ bearerAuth: [] ]
      let(:id) { employee.id }
      response(200, "carer") { schema "$ref" => "#/components/schemas/Employee"; run_test! }
    end

    patch("Update a carer") do
      tags "Office — People"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: {
          first_name: { type: :string }, last_name: { type: :string }, phone: { type: :string }, role: { type: :string },
          active: { type: :boolean }, contracted_hours_per_week: { type: :number }
        }
      }
      let(:id) { employee.id }
      response(200, "updated") { schema "$ref" => "#/components/schemas/Employee"; let(:body) { { phone: "07700 900123" } }; run_test! }
    end
  end

  path "/api/v1/admin/employees/{id}/availability" do
    parameter name: :id, in: :path, type: :integer
    get("A carer's weekly availability pattern") do
      tags "Office — People"; produces "application/json"; security [ bearerAuth: [] ]
      let(:id) { employee.id }
      response(200, "availability") do
        schema type: :array, items: { type: :object, properties: {
          weekday: { type: :integer, description: "0=Monday .. 6=Sunday" },
          slot: { type: :string, enum: %w[morning afternoon evening night] }, available: { type: :boolean }
        } }
        run_test!
      end
    end
  end

  # ---- Care package slot edit ----
  path "/api/v1/admin/care_package_slots/{id}" do
    parameter name: :id, in: :path, type: :integer
    patch("Edit a recurring call") do
      tags "Office — Care Packages"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: {
          name: { type: :string }, start_time: { type: :string }, end_time: { type: :string },
          recurrence: { type: :string }, staff_required: { type: :integer }, break_minutes: { type: :integer }, active: { type: :boolean }
        }
      }
      let(:id) { create(:care_package_slot, service_user: su).id }
      response(200, "updated") { let(:body) { { staff_required: 2 } }; run_test! }
    end
  end

  # ---- Care plan item edit / soft-delete ----
  path "/api/v1/admin/service_users/{service_user_id}/care_plan_items/{id}" do
    parameter name: :service_user_id, in: :path, type: :integer
    parameter name: :id, in: :path, type: :integer
    let(:item) { su.care_plan_items.create!(category: "medication", label: "8am tablets") }

    patch("Edit a care plan item") do
      tags "Office — Care Plan"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: { type: :object, properties: { category: { type: :string }, label: { type: :string }, detail: { type: :string }, position: { type: :integer } } }
      let(:service_user_id) { su.id }
      let(:id) { item.id }
      response(200, "updated") { let(:body) { { label: "9am tablets" } }; run_test! }
    end

    delete("Remove a care plan item (soft-delete)") do
      tags "Office — Care Plan"; security [ bearerAuth: [] ]
      description "Sets active: false; the item and its history are kept."
      let(:service_user_id) { su.id }
      let(:id) { item.id }
      response(204, "removed") { run_test! }
    end
  end

  # ---- Alerts: acknowledge / resolve ----
  path "/api/v1/admin/alerts/{id}/acknowledge" do
    parameter name: :id, in: :path, type: :integer
    post("Acknowledge an alert") do
      tags "Office — Monitoring"; produces "application/json"; security [ bearerAuth: [] ]
      let(:id) { Alert.create!(alert_type: "missed_visit", severity: "high", subject: assignment).id }
      response(200, "acknowledged") { run_test! }
    end
  end

  path "/api/v1/admin/alerts/{id}/resolve" do
    parameter name: :id, in: :path, type: :integer
    post("Resolve an alert (optional note)") do
      tags "Office — Monitoring"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, required: false, schema: { type: :object, properties: { resolution_note: { type: :string } } }
      let(:id) { Alert.create!(alert_type: "no_clock_out", subject: assignment).id }
      let(:body) { { resolution_note: "Carer confirmed clock-out time by phone." } }
      response(200, "resolved") { run_test! }
    end
  end

  # ---- Withdraw an assignment ----
  path "/api/v1/admin/visit_assignments/{id}" do
    parameter name: :id, in: :path, type: :integer
    delete("Withdraw an assignment (for reassignment)") do
      tags "Office — Rota"; security [ bearerAuth: [] ]
      description "Marks the assignment withdrawn + cancelled and appends an assignment.withdrawn audit event. The original record is kept."
      let(:id) { assignment.id }
      response(204, "withdrawn") { run_test! }
    end
  end

  # ---- Exports (rota / audit / reports) — stream a CSV or XLSX file ----
  path "/api/v1/admin/rota_exports" do
    get("Export the rota (CSV or XLSX)") do
      tags "Office — Rota"; produces "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; security [ bearerAuth: [] ]
      description "Visits + carer assignments for a date range. type=csv (default) or xlsx."
      parameter name: :from, in: :query, required: false, schema: { type: :string, format: :date }
      parameter name: :to,   in: :query, required: false, schema: { type: :string, format: :date }
      parameter name: :type, in: :query, required: false, schema: { type: :string, enum: %w[csv xlsx] }
      before { create(:visit, service_user: su) }
      let(:type) { "csv" }
      response(200, "file") { run_test! }
    end
  end

  path "/api/v1/admin/audit_exports" do
    get("Export the audit log (CSV or XLSX)") do
      tags "Office — Audit"; produces "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; security [ bearerAuth: [] ]
      description "Append-only Event log as a file. Same filters as /admin/audit (event_type, aggregate_type, limit). type=csv (default) or xlsx."
      parameter name: :type,           in: :query, required: false, schema: { type: :string, enum: %w[csv xlsx] }
      parameter name: :event_type,     in: :query, required: false, schema: { type: :string }
      parameter name: :aggregate_type, in: :query, required: false, schema: { type: :string }
      parameter name: :limit,          in: :query, required: false, schema: { type: :integer }
      let(:type) { "csv" }
      response(200, "file") { run_test! }
    end
  end

  path "/api/v1/admin/report_exports" do
    get("Export the report pack (CSV or XLSX)") do
      tags "Office — Reports"; produces "text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"; security [ bearerAuth: [] ]
      description "Clocking-performance aggregates for a date range. type=csv (default) or xlsx."
      parameter name: :from, in: :query, required: false, schema: { type: :string, format: "date-time" }
      parameter name: :to,   in: :query, required: false, schema: { type: :string, format: "date-time" }
      parameter name: :type, in: :query, required: false, schema: { type: :string, enum: %w[csv xlsx] }
      let(:type) { "csv" }
      response(200, "file") { run_test! }
    end
  end
end
