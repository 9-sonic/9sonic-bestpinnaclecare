require "rails_helper"
require "csv"

RSpec.describe "Admin attendance audit export", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }
  let(:su)    { create(:service_user, first_name: "Amber", last_name: "Kingham", lat: 51.406984, lng: -1.250699) }

  def seed_visit(start:, late_in: 0)
    v  = create(:visit, service_user: su, scheduled_start: start, scheduled_end: start + 45.minutes)
    va = create(:visit_assignment, visit: v)
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: start + late_in.minutes, lat: 51.406984, lng: -1.250699, actor: va.employee
    )
    va
  end

  it "streams a CSV with the exact CQC column headers" do
    seed_visit(start: 1.hour.ago)

    get "/api/v1/admin/attendance_audit_exports", params: { type: "csv" }, headers: auth
    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("text/csv")

    header = CSV.parse(response.body).first
    expect(header).to eq(AttendanceAudit::Rows::HEADERS)
    expect(header).to include("Offline clock in", "Clock In Metres Away", "Clock in Map", "Reason")
  end

  it "includes the carer, client and a lateness cell in the data rows" do
    seed_visit(start: 2.hours.ago, late_in: 5)

    get "/api/v1/admin/attendance_audit_exports", params: { type: "csv" }, headers: auth
    table = CSV.parse(response.body)
    row   = table[1]
    expect(row[1]).to eq("Amber Kingham")             # Service User column
    expect(row).to include("5 minutes")               # Clock in Late
    expect(row.join(",")).to include("maps/dir/")      # Clock in Map
  end

  it "respects the from/to date range" do
    seed_visit(start: 10.days.ago) # outside range

    from = 2.days.ago.iso8601
    to   = Time.current.iso8601
    get "/api/v1/admin/attendance_audit_exports", params: { from:, to:, type: "csv" }, headers: auth

    table = CSV.parse(response.body)
    expect(table.size).to eq(1) # header only, no data rows
  end

  it "renders 'Yes' in the Offline column for an offline-synced tap" do
    v  = create(:visit, service_user: su, scheduled_start: 90.minutes.ago, scheduled_end: 45.minutes.ago)
    va = create(:visit_assignment, visit: v)
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
      occurred_at: v.scheduled_start, lat: 51.406984, lng: -1.250699, actor: va.employee, on_block: :flag
    )

    get "/api/v1/admin/attendance_audit_exports", params: { type: "csv" }, headers: auth
    row = CSV.parse(response.body)[1]
    expect(row[6]).to eq("Yes") # "Offline clock in" column
  end

  it "streams an XLSX when asked" do
    seed_visit(start: 1.hour.ago)

    get "/api/v1/admin/attendance_audit_exports", params: { type: "xlsx" }, headers: auth
    expect(response).to have_http_status(:ok)
    expect(response.media_type).to eq("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    expect(response.body.bytesize).to be > 0
  end

  it "requires an admin token" do
    get "/api/v1/admin/attendance_audit_exports", params: { type: "csv" }
    expect(response).to have_http_status(:unauthorized)
  end

  describe "GET /admin/attendance_audit_exports/rows — JSON for the on-screen table" do
    it "returns the same rows as JSON" do
      seed_visit(start: 2.hours.ago, late_in: 5)

      get "/api/v1/admin/attendance_audit_exports/rows", headers: auth
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["total"]).to eq(1)
      rows = body["items"]
      expect(rows.size).to eq(1)
      expect(rows.first).to include("staff", "service_user" => "Amber Kingham", "late_in" => 5)
      # The on-screen table carries the assignment id so a manager can amend the
      # clock times from here (the export CSV/XLSX omit it).
      expect(rows.first["visit_assignment_id"]).to be_present
      # Range-wide summary counts drive the stat cards under pagination.
      expect(body["summary"]).to include("total" => 1, "late" => 1)
    end

    it "filters by service_user_id" do
      seed_visit(start: 1.hour.ago)
      other_su = create(:service_user, first_name: "Other", last_name: "Client")
      v2 = create(:visit, service_user: other_su, scheduled_start: 1.hour.ago, scheduled_end: 15.minutes.ago)
      create(:visit_assignment, visit: v2)

      get "/api/v1/admin/attendance_audit_exports/rows", params: { service_user_id: su.id }, headers: auth
      rows = response.parsed_body["items"]
      expect(rows.size).to eq(1)
      expect(rows.first["service_user"]).to eq("Amber Kingham")
    end

    it "filters by employee_id" do
      va1 = seed_visit(start: 1.hour.ago)
      other_visit = create(:visit, service_user: su, scheduled_start: 1.hour.ago, scheduled_end: 15.minutes.ago)
      create(:visit_assignment, visit: other_visit)

      get "/api/v1/admin/attendance_audit_exports/rows", params: { employee_id: va1.employee_id }, headers: auth
      rows = response.parsed_body["items"]
      expect(rows.size).to eq(1)
      expect(rows.first["staff"]).to eq(va1.employee.full_name)
    end

    it "requires an admin token" do
      get "/api/v1/admin/attendance_audit_exports/rows"
      expect(response).to have_http_status(:unauthorized)
    end
  end
end
