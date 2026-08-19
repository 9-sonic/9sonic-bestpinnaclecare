# Best Pinnacle Care — initial seed data.
#
#   bin/rails db:seed
#   FORCE_SEED=1 RAILS_ENV=production bin/rails db:seed
#
# Wipes existing table data and creates initial required configuration and
# a single admin user account.
require "securerandom"

if Rails.env.production? && ENV["FORCE_SEED"].blank?
  abort "Refusing to seed production without FORCE_SEED=1"
end

DEMO_PASSWORD = "Password123!".freeze
DEMO_MFA_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP".freeze

# ---------------------------------------------------------------------------
# Reset: Truncate all tables to guarantee a clean state
# ---------------------------------------------------------------------------
tables = %w[
  visit_notes visit_tasks care_plan_items employee_availabilities mileage_claims
  clock_events events visit_assignments visits care_package_slots service_users
  message_receipts message_attachments messages conversation_participants conversations
  notifications notification_preferences alerts
  refresh_tokens devices webauthn_credentials jwt_denylist
  employees admins settings
]
existing_tables = tables & ActiveRecord::Base.connection.tables
if existing_tables.any?
  ActiveRecord::Base.connection.execute("TRUNCATE #{existing_tables.join(', ')} RESTART IDENTITY CASCADE")
  puts "Cleared existing data."
end

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
Setting.create!(
  id: 1,
  company_name: "Best Pinnacle Care Ltd",
  trading_name: "Best Pinnacle Care",
  cqc_provider_id: "1-101010101",
  cqc_location_id: "1-202020202",
  address_line1: "Pinnacle House, 12 Deansgate",
  city: "Manchester",
  postcode: "M3 2AB",
  phone: "0161 555 0100",
  email: "office@bestpinnacle.test",
  geofence_mode: "block",
  geofence_radius_m: 150
)

# ---------------------------------------------------------------------------
# Admin User (Single Admin)
# ---------------------------------------------------------------------------
admin = Admin.create!(
  email: "manager@bestpinnacle.test",
  password: DEMO_PASSWORD,
  first_name: "Rebecca",
  last_name: "Hartley",
  role: :registered_manager,
  active: true,
  accepted_invite_at: 30.days.ago,
  mfa_enabled: false,
  mfa_confirmed_at: nil,
  mfa_secret: DEMO_MFA_SECRET
)

# ---------------------------------------------------------------------------
# Carers (for local/staging login testing)
# ---------------------------------------------------------------------------
aisha = Employee.create!(
  email: "aisha@bestpinnacle.test",
  password: DEMO_PASSWORD,
  first_name: "Aisha",
  last_name: "Yusuf",
  role: :carer,
  active: true,
  accepted_invite_at: 14.days.ago,
  contracted_hours_per_week: 37.5
)
tom = Employee.create!(
  email: "tom@bestpinnacle.test",
  password: DEMO_PASSWORD,
  first_name: "Tom",
  last_name: "Whitfield",
  role: :carer,
  active: true,
  accepted_invite_at: 20.days.ago,
  contracted_hours_per_week: 40
)

# ---------------------------------------------------------------------------
# Clients (service users) — real Manchester-area coordinates so a clock-in at
# the same point passes the geofence like a real visit would.
# ---------------------------------------------------------------------------
ada = ServiceUser.create!(
  first_name: "Ada", last_name: "Whitfield", reference: "SU-1001",
  address_line1: "14 Oxford Road", city: "Manchester", postcode: "M1 5QA",
  lat: 53.4776, lng: -2.2416, active: true
)
frank = ServiceUser.create!(
  first_name: "Frank", last_name: "Doyle", reference: "SU-1002",
  address_line1: "82 Chester Road", city: "Manchester", postcode: "M15 4EU",
  lat: 53.4711, lng: -2.2529, active: true
)

# ---------------------------------------------------------------------------
# Visits + clock events over the last few days — a spread of real attendance
# outcomes (on time, late, offline-synced, missed clock-out) so the CQC
# visit-attendance audit (Timesheets) has something to show straight away.
# Written through Clocking::RecordClockEvent, the same writer the app uses
# live, so lifecycle state and worked_minutes come out consistent.
# ---------------------------------------------------------------------------
def seed_visit(su:, employee:, start:, minutes: 45, clock_in_late_by: 0, clock_out: true, offline_in: false, lat: nil, lng: nil)
  v = Visit.create!(service_user: su, scheduled_start: start, scheduled_end: start + minutes.minutes, status: :published, published_at: Time.current)
  va = VisitAssignment.create!(visit: v, employee: employee, assignment_status: "assigned", lifecycle_state: :scheduled)

  in_at = start + clock_in_late_by.minutes
  Clocking::RecordClockEvent.call(
    visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
    occurred_at: in_at, lat: lat || su.lat, lng: lng || su.lng, accuracy_m: 12,
    actor: employee, on_block: offline_in ? :flag : :reject
  )

  if clock_out
    Clocking::RecordClockEvent.call(
      visit_assignment: va, kind: "clock_out", client_event_id: SecureRandom.uuid,
      occurred_at: start + minutes.minutes, lat: lat || su.lat, lng: lng || su.lng, accuracy_m: 12,
      actor: employee, on_block: :reject
    )
  end
  va
end

# Aisha: on-time visit today, a late arrival yesterday, an offline-synced tap.
seed_visit(su: ada,   employee: aisha, start: 2.hours.ago)
seed_visit(su: frank, employee: aisha, start: 1.day.ago.change(hour: 9), clock_in_late_by: 8)
seed_visit(su: ada,   employee: aisha, start: 2.days.ago.change(hour: 14), offline_in: true)

# Tom: on-time visit, and one still missing a clock-out (in progress).
seed_visit(su: frank, employee: tom, start: 3.hours.ago)
seed_visit(su: ada,   employee: tom, start: 1.hour.ago, clock_out: false)

puts "\n" + ("=" * 64)
puts "Seed complete. Cleaned DB and created 1 Admin, 2 carers, 2 clients, 5 visits."
puts "-" * 64
puts "Admin Email:    #{admin.email}"
puts "Admin Password: #{DEMO_PASSWORD}"
puts "-" * 64
puts "Carer Email:    #{aisha.email}"
puts "Carer Email:    #{tom.email}"
puts "Carer Password: #{DEMO_PASSWORD}"
puts "-" * 64
puts "Visit attendance data seeded for the last 2 days — view it on Timesheets."
puts "=" * 64
