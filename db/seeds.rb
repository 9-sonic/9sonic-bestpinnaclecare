# Best Pinnacle Care — INITIAL seed (one-time, wipes then loads).
#
#   bin/rails db:seed                        # dev
#   FORCE_SEED=1 RAILS_ENV=production ...     # prod, first load only
#
# This TRUNCATES and rebuilds from the RoundSys export — it is the first-time
# load for an EMPTY system. It refuses to run once real clock-ins exist, so it
# can't wipe live data after go-live.
#
# To TOP UP more history later (e.g. the 28 Aug–1 Sep batch) WITHOUT wiping, use
# the additive, idempotent task instead — safe to re-run any time:
#
#   bin/rails roundsys:import
#
# That's also what the deploy runs. Both share Seeding::RoundsysImport.
require "securerandom"
require "json"

DEMO_PASSWORD = "Password123!".freeze
DEMO_MFA_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP".freeze

if Rails.env.production? && ENV["FORCE_SEED"].blank?
  abort "Refusing to seed production without FORCE_SEED=1"
end

# Hard stop: never let the wiping seed destroy real attendance. Once a carer has
# clocked in live (a "live"-origin clock event that isn't part of the historical
# import), this DB is in use — top up with `rails roundsys:import` instead.
if ClockEvent.where(origin: "live").where("occurred_at > ?", Date.new(2026, 9, 1).end_of_day).exists?
  abort "Refusing to wipe: live clock-ins after go-live exist. Use `rails roundsys:import` to add data instead."
end

# ---------------------------------------------------------------------------
# Reset: truncate all tables to guarantee a clean state
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
# Settings — provider record. NOTE: the real CQC provider/location IDs and
# registered address were NOT in the RoundSys export — confirm with Jesse and
# replace before this is treated as the source of truth.
# ---------------------------------------------------------------------------
Setting.create!(
  id: 1,
  company_name: "Best Pinnacle Care Ltd",
  trading_name: "Best Pinnacle Care",
  cqc_provider_id: nil,
  cqc_location_id: nil,
  geofence_mode: "block",
  geofence_radius_m: 150
)

# ---------------------------------------------------------------------------
# Test manager admin — the login you already know.
# ---------------------------------------------------------------------------
manager = Admin.create!(
  email: "manager@bestpinnacle.test",
  password: DEMO_PASSWORD,
  first_name: "Rebecca",
  last_name: "Hartley",
  role: :manager,
  active: true,
  accepted_invite_at: 30.days.ago,
  mfa_enabled: false,
  mfa_confirmed_at: nil,
  mfa_secret: DEMO_MFA_SECRET
)

# Office staff -> Admin logins. MFA off so they can sign in on a fresh
# environment; everyone shares the dev password (the export had none).
people = JSON.parse(File.read(Rails.root.join("db/seed_data/roundsys.json")))
admins = 0
people["admins"].each do |a|
  next if a["email"] == manager.email

  Admin.create!(
    email: a["email"], password: DEMO_PASSWORD,
    first_name: a["first_name"], last_name: a["last_name"], phone: a["phone"],
    role: a["role"], active: true, accepted_invite_at: Time.current, mfa_enabled: false
  )
  admins += 1
end

# ---------------------------------------------------------------------------
# Real staff, service users, and (optionally) the historical visits — loaded
# through the SAME additive importer the top-up task uses, so there's one code
# path. On this empty DB it simply creates everything. Visits are slow (~4,900
# rows), so they're opt-in via SEED_VISITS=1.
# ---------------------------------------------------------------------------
if ENV["SEED_VISITS"].present?
  res = Seeding::RoundsysImport.call
  carers = res.carers
  users  = res.service_users
  visit_count = res.visits
  deactivated = res.deactivated
else
  # Staff + service users only (fast). Reuse the importer but skip visits by
  # pointing it at an empty visit set.
  res = Seeding::RoundsysImport.new(visits_path: nil).call_people_only
  carers = res.carers
  users  = res.service_users
  visit_count = 0
  deactivated = 0
end

puts "\n" + ("=" * 64)
puts "Seed complete (initial load)."
puts "-" * 64
puts "Test admin login: #{manager.email} / #{DEMO_PASSWORD}"
puts "Real office admins: #{admins}  (password #{DEMO_PASSWORD}, MFA off)"
puts "Carers:             #{carers}  (password #{DEMO_PASSWORD})"
puts "Service users:      #{users}"
if ENV["SEED_VISITS"].present?
  puts "Visits imported:    #{visit_count}  (+ #{deactivated} deactivated carers for history)"
else
  puts "Visits:             skipped (set SEED_VISITS=1 to import the historical visits)"
end
puts "=" * 64
