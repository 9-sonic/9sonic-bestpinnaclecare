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
  timesheet_disputes timesheet_lines timesheet_periods
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

puts "\n" + ("=" * 64)
puts "Seed complete. Cleaned DB and created 1 Admin user."
puts "-" * 64
puts "Admin Email:    #{admin.email}"
puts "Admin Password: #{DEMO_PASSWORD}"
puts "=" * 64
