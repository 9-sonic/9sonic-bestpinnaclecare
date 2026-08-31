# Best Pinnacle Care — seed data.
#
#   bin/rails db:seed
#   FORCE_SEED=1 RAILS_ENV=production bin/rails db:seed
#
# Wipes existing table data, then loads the real staff and service users
# exported from the RoundSys manager portal (db/seed_data/roundsys.json), plus
# the single test manager admin used to log into the console.
#
# The JSON is generated from docs/roundsys_staff_service_users_addresses.xlsx —
# checked in so seeding needs no xlsx-parsing gem on the server.
require "securerandom"
require "json"

if Rails.env.production? && ENV["FORCE_SEED"].blank?
  abort "Refusing to seed production without FORCE_SEED=1"
end

DEMO_PASSWORD = "Password123!".freeze
DEMO_MFA_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP".freeze

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
# Settings — provider record. NOTE: company_name/postcode/phone are placeholders
# taken from the office address; the real CQC provider/location IDs and
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
# Test manager admin — the login you already know. Kept alongside the real data.
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

# ---------------------------------------------------------------------------
# Real staff + service users from the RoundSys export.
# ---------------------------------------------------------------------------
data = JSON.parse(File.read(Rails.root.join("db/seed_data/roundsys.json")))

# Office staff (Manager / Registered Manager / Duty Officer) -> Admin logins.
# MFA off so they can sign in on a fresh environment; everyone shares the dev
# password (the export carried no passwords). Skip the seeded test manager's
# email if it ever clashes.
admins = 0
data["admins"].each do |a|
  next if a["email"] == manager.email

  Admin.create!(
    email: a["email"],
    password: DEMO_PASSWORD,
    first_name: a["first_name"],
    last_name: a["last_name"],
    phone: a["phone"],
    role: a["role"],           # registered_manager | manager | coordinator
    active: true,
    accepted_invite_at: Time.current,
    mfa_enabled: false
  )
  admins += 1
end

# Careworkers -> Employees (the only employee_role is :carer).
carers = 0
data["employees"].each do |e|
  Employee.create!(
    email: e["email"],
    password: DEMO_PASSWORD,
    first_name: e["first_name"],
    last_name: e["last_name"],
    phone: e["phone"],
    role: :carer,
    # Leave employee_reference unset so the model assigns OUR standard EMP-XXXX
    # code (the raw RoundSys staff ID isn't our reference format).
    emergency_contact_name: e["emergency_contact_name"],
    emergency_contact_phone: e["emergency_contact_phone"],
    contracted_hours_per_week: e["contracted_hours_per_week"],
    active: true,
    accepted_invite_at: Time.current
  )
  carers += 1
end

# Service users — with real address + lat/lng (the geofence anchor). Seeded
# verbatim; a shared_site flag means the coordinates match another service user
# (a radius geofence alone can't tell those visits apart).
users = 0
data["service_users"].each do |su|
  ServiceUser.create!(
    first_name: su["first_name"],
    last_name: su["last_name"],
    # `reference` is OUR client code — leave it unset so the model assigns the
    # standard SU-XXXX (before_create). The export's "Council Service User ID"
    # goes in its own council_id field, not reference.
    council_id: su["reference"],
    date_of_birth: su["date_of_birth"],
    address_line1: su["address_line1"],
    postcode: su["postcode"],
    lat: su["lat"],
    lng: su["lng"],
    active: true
  )
  users += 1
end

# ---------------------------------------------------------------------------
# Historical visits (RoundSys CQC export, ~3k rows). Optional — set SEED_VISITS=1
# to include them (it's slow: each visit writes 1–2 clock events through the real
# Clocking::RecordClockEvent so lifecycle/worked-minutes/geofence come out exactly
# as the live app would compute them). Skipped by default so a routine reseed is
# fast; run once with SEED_VISITS=1 to populate attendance history.
# ---------------------------------------------------------------------------
visit_count = 0
deactivated = 0
if ENV["SEED_VISITS"].present?
  vdata = JSON.parse(File.read(Rails.root.join("db/seed_data/roundsys_visits.json")))

  # Carers who appear in the visit history but not in the current-staff sheet
  # (leavers, plus two office managers who did the odd visit) — created as
  # DEACTIVATED so their history has an owner without cluttering the live roster.
  vdata["extra_carers"].each do |c|
    next if Employee.exists?(email: c["email"])

    Employee.create!(
      email: c["email"], password: DEMO_PASSWORD,
      first_name: c["first_name"], last_name: c["last_name"],
      role: :carer, active: false, accepted_invite_at: 1.year.ago
    )
    deactivated += 1
  end

  emp_by_email = Employee.pluck(:email, :id).to_h
  su_by_name = ServiceUser.all.index_by { |s| "#{s.first_name} #{s.last_name}" }

  # Build one historical clock event, fully-formed, in a single INSERT. This is
  # deliberately NOT routed through Clocking::RecordClockEvent + a follow-up
  # update: clock_events carries a DB-level append-only RULE (clock_events_no_update
  # -> DO INSTEAD NOTHING) that SILENTLY swallows any UPDATE. So distance, geofence
  # and origin must be set at INSERT time or they're lost without any error — which
  # is exactly what happened before. INSERT is allowed by the rule; UPDATE is not.
  #
  #   distance/geofence : the export's real metres, pass/fail vs the fence radius.
  #   origin            : offline_sync for a tap the carer made offline (synced
  #                       later), else "live" — because these ARE the carers' real
  #                       taps from the field, not admin corrections. (An earlier
  #                       version marked them manual_admin to dodge the live
  #                       skew-check, but that misrepresented an honest carer tap
  #                       as a manual admin entry. We insert directly now, so we
  #                       set the true origin.)
  #   method            : "gps" — the carer clocked on the app with a location fix.
  build_event = lambda do |va, kind, at, lat, lng, metres, radius, offline|
    geo = metres.nil? ? "not_checked" : (metres <= radius ? "pass" : "fail")
    ClockEvent.create!(
      visit_assignment: va, kind: kind, occurred_at: at, recorded_at: at,
      lat: lat, lng: lng, distance_from_site_m: metres, geofence_result: geo,
      origin: offline ? "offline_sync" : "live",
      method: "gps", client_event_id: SecureRandom.uuid
    )
  end

  grace = (Setting.instance.late_grace_minutes || 15).minutes

  vdata["visits"].each do |v|
    emp_id = emp_by_email[v["carer_email"]]
    su = su_by_name[v["su"]]
    next unless emp_id && su

    started = Time.zone.parse(v["clocked_in"])
    ended   = v["clocked_out"] ? Time.zone.parse(v["clocked_out"]) : nil
    radius  = su.geofence_radius_m || 150
    # Scheduled window: back out the recorded lateness so late arrivals stay late.
    # It's scheduling metadata (the real taps are kept verbatim on the events);
    # the model requires >= 15 min, and some rows have a near-instant/missing
    # clock-out, so clamp to a sane minimum.
    sched_start = started - (v["late_in_min"] || 0).minutes
    sched_end   = ended && ended > sched_start ? ended : sched_start + 45.minutes
    sched_end   = sched_start + 15.minutes if sched_end < sched_start + 15.minutes

    visit = Visit.create!(service_user: su, scheduled_start: sched_start, scheduled_end: sched_end,
                          status: :published, published_at: sched_start)

    # Compute the FINAL outcome and create the assignment with it in one shot —
    # NOT as :scheduled-then-update. These visits are months in the past, so the
    # timer-driven Lifecycle::EvaluateStatesJob (which runs in the background)
    # would grab any assignment left in :scheduled and, seeing it long overdue,
    # flip it to :missed and raise a false alert. Setting the terminal state at
    # create time closes that race — a completed visit stays completed.
    #   both taps -> completed; only a clock-in -> in_progress (late if past grace).
    if ended
      lifecycle = :completed
      cols = { actual_start: started, actual_end: ended, worked_minutes: ((ended - started) / 60).round }
    else
      lifecycle = started > sched_start + grace ? :late : :in_progress
      cols = { actual_start: started }
    end
    va = VisitAssignment.create!(visit: visit, employee_id: emp_id,
                                 assignment_status: "assigned", lifecycle_state: lifecycle, **cols)

    build_event.call(va, "clock_in", started, v["in_lat"], v["in_lng"], v["in_metres"], radius, v["offline_in"])
    build_event.call(va, "clock_out", ended, v["out_lat"] || v["in_lat"], v["out_lng"] || v["in_lng"], v["out_metres"], radius, v["offline_out"]) if ended

    visit_count += 1
    puts "  seeded #{visit_count} visits…" if (visit_count % 500).zero?
  end
end

puts "\n" + ("=" * 64)
puts "Seed complete."
puts "-" * 64
puts "Test admin login: #{manager.email} / #{DEMO_PASSWORD}"
puts "Real office admins: #{admins}  (password #{DEMO_PASSWORD}, MFA off)"
puts "Carers:             #{carers}  (password #{DEMO_PASSWORD})"
puts "Service users:      #{users}"
if ENV["SEED_VISITS"].present?
  puts "Visits imported:    #{visit_count}  (+ #{deactivated} deactivated carers for history)"
else
  puts "Visits:             skipped (set SEED_VISITS=1 to import ~3k historical visits)"
end
puts "=" * 64
