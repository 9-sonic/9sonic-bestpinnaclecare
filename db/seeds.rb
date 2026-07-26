# Best Pinnacle Care — demo seed data (for PR review / local exploration).
#
#   bin/rails db:seed
#
# Wipes and rebuilds a realistic dataset by exercising the real services
# (visit generation, geofenced clocking, alerts, timesheets, chat). Safe to
# re-run. Refuses to touch production unless FORCE_SEED=1.
require "securerandom"

if Rails.env.production? && ENV["FORCE_SEED"].blank?
  abort "Refusing to seed production without FORCE_SEED=1"
end

DEMO_PASSWORD = "Password123!".freeze

# ---------------------------------------------------------------------------
# Reset (clock_events/events are append-only, so TRUNCATE, never DELETE)
# ---------------------------------------------------------------------------
tables = %w[
  clock_events events visit_assignments visits care_package_slots service_users
  timesheet_disputes timesheet_lines timesheet_periods
  message_receipts message_attachments messages conversation_participants conversations
  notifications notification_preferences alerts
  refresh_tokens devices webauthn_credentials jwt_denylist
  employees admins settings
]
ActiveRecord::Base.connection.execute("TRUNCATE #{tables.join(', ')} RESTART IDENTITY CASCADE")
puts "Cleared existing data."

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def clock!(va, kind, at, geofence: :pass)
  su = va.visit.service_user
  ClockEvent.create!(
    visit_assignment: va, kind: kind, occurred_at: at, recorded_at: at, method: "gps",
    lat: su.lat, lng: su.lng, geofence_result: geofence,
    distance_from_site_m: (geofence == :pass ? rand(5..70) : nil),
    device_fingerprint: SecureRandom.uuid, client_event_id: SecureRandom.uuid, created_by: va.employee
  )
end

def complete_visit!(va)
  v  = va.visit
  ci = v.scheduled_start + rand(-4..6).minutes
  co = v.scheduled_end + rand(-8..4).minutes
  clock!(va, :clock_in, ci)
  clock!(va, :clock_out, co)
  va.update!(lifecycle_state: :completed, actual_start: ci, actual_end: co, worked_minutes: ((co - ci) / 60).round)
end

def clock_in_only!(va)
  ci = va.visit.scheduled_start + rand(-4..6).minutes
  clock!(va, :clock_in, ci)
  va.update!(lifecycle_state: :in_progress, actual_start: ci)
end

# ---------------------------------------------------------------------------
# Settings
# ---------------------------------------------------------------------------
Setting.create!(
  id: 1, company_name: "Best Pinnacle Care Ltd", trading_name: "Best Pinnacle Care",
  cqc_provider_id: "1-101010101", cqc_location_id: "1-202020202",
  address_line1: "Pinnacle House, 12 Deansgate", city: "Manchester", postcode: "M3 2AB",
  phone: "0161 555 0100", email: "office@bestpinnacle.test",
  geofence_mode: "block", geofence_radius_m: 150
)

# ---------------------------------------------------------------------------
# Admins (one per role) — MFA off so reviewers can log straight in
# ---------------------------------------------------------------------------
admins = {
  registered_manager: [ "Rebecca", "Hartley",   "manager@bestpinnacle.test" ],
  manager:            [ "Marcus",  "Doyle",      "ops@bestpinnacle.test" ],
  coordinator:        [ "Carly",   "Fields",     "coordinator@bestpinnacle.test" ],
  finance:            [ "Fiona",   "Nwosu",      "finance@bestpinnacle.test" ],
  auditor:            [ "Alan",    "Pierce",     "auditor@bestpinnacle.test" ]
}.map do |role, (first, last, email)|
  Admin.create!(email: email, password: DEMO_PASSWORD, first_name: first, last_name: last,
                role: role, mfa_enabled: false, active: true, accepted_invite_at: 30.days.ago)
end
registered_manager = admins.first
finance_admin = admins.find(&:finance?) || registered_manager

# ---------------------------------------------------------------------------
# Employees (carers)
# ---------------------------------------------------------------------------
carers = [
  %w[Aisha Khan],  %w[Ben Carter],  %w[Chloe Davies],
  %w[Dan Evans],   %w[Ella Foster], %w[Femi Okafor]
].each_with_index.map do |(first, last), i|
  Employee.create!(
    email: "#{first.downcase}@bestpinnacle.test", password: DEMO_PASSWORD,
    first_name: first, last_name: last, role: (i.zero? ? :senior_carer : :carer),
    employee_reference: "EMP#{1001 + i}", active: true, accepted_invite_at: 25.days.ago
  )
end

# ---------------------------------------------------------------------------
# Service users (patients) — homes around south Manchester
# ---------------------------------------------------------------------------
homes = [
  [ "Ada",    "Whitfield", "14 Elm Grove",     "Didsbury",    "M20 2XY", 53.4109, -2.2310 ],
  [ "Bert",   "Holloway",  "3 Oak Lane",       "Chorlton",    "M21 9PQ", 53.4426, -2.2790 ],
  [ "Cora",   "Bassett",   "27 Birch Road",    "Withington",  "M20 4LP", 53.4330, -2.2280 ],
  [ "Dennis", "Ng",        "5 Maple Close",    "Fallowfield", "M14 6RT", 53.4420, -2.2190 ],
  [ "Edith",  "Ramsay",    "41 Cedar Avenue",  "Burnage",     "M19 1AA", 53.4270, -2.2010 ],
  [ "Frank",  "Osei",      "8 Willow Terrace", "Levenshulme", "M19 3PP", 53.4400, -2.1900 ]
].map do |first, last, addr, city, pc, lat, lng|
  ServiceUser.create!(
    first_name: first, last_name: last, address_line1: addr, city: city, postcode: pc,
    lat: lat, lng: lng, geofence_radius_m: 150, active: true,
    date_of_birth: Date.new(rand(1935..1955), rand(1..12), rand(1..28)),
    phone: "0161 555 0#{rand(100..999)}",
    access_notes: "Key safe by the front door; code on file. Ring the bell and wait."
  )
end
puts "#{admins.size} admins, #{carers.size} carers, #{homes.size} service users."

# ---------------------------------------------------------------------------
# Care packages (recurring calls) per service user
# ---------------------------------------------------------------------------
CALLS = [
  [ "Morning call", "08:00", "08:45" ],
  [ "Lunch call",   "12:00", "12:30" ],
  [ "Tea call",     "17:00", "17:45" ],
  [ "Bedtime call", "21:00", "21:30" ]
].freeze

ServiceUser.find_each do |su|
  CALLS.first(rand(2..4)).each do |name, start_t, end_t|
    CarePackageSlot.create!(service_user: su, name: name, start_time: start_t, end_time: end_t,
                            recurrence: "daily", staff_required: 1, break_minutes: 0,
                            effective_from: 30.days.ago.to_date, active: true)
  end
end

# ---------------------------------------------------------------------------
# Generate visits (last week + this week), publish, assign carers
# ---------------------------------------------------------------------------
week_start = Date.current.beginning_of_week
Visits::GenerateFromCarePackages.call(from: week_start - 7, to: week_start + 6)
Visit.update_all(status: "published", published_at: Time.current, published_by_admin_id: registered_manager.id)

Visit.order(:scheduled_start, :id).each_with_index do |visit, i|
  VisitAssignment.create!(visit: visit, employee: carers[i % carers.size], assigned_by: registered_manager)
end
puts "#{Visit.count} visits generated + assigned."

# ---------------------------------------------------------------------------
# Simulate clocking: complete past visits, mark current ones in-progress
# ---------------------------------------------------------------------------
now = Time.current
VisitAssignment.joins(:visit).where("visits.scheduled_end < ?", now).where(lifecycle_state: "scheduled").includes(:visit).find_each { |va| complete_visit!(va) }
VisitAssignment.joins(:visit).where("visits.scheduled_start < ? AND visits.scheduled_end > ?", now, now).where(lifecycle_state: "scheduled").includes(:visit).find_each { |va| clock_in_only!(va) }
puts "#{ClockEvent.count} clock events; #{VisitAssignment.completed.count} completed, #{VisitAssignment.in_progress.count} in progress."

# ---------------------------------------------------------------------------
# Exceptions demo: a missed visit + a no-GPS pending-review visit (both today,
# both raise alerts that fan out notifications to the office)
# ---------------------------------------------------------------------------
[ [ :missed, "missed_visit" ], [ :pending_review, "geo_anomaly" ] ].each_with_index do |(state, alert_type), i|
  su = ServiceUser.all.sample
  vstart = (2 + i).hours.ago
  visit = Visit.create!(service_user: su, scheduled_start: vstart, scheduled_end: vstart + 45.minutes,
                        status: :published, published_at: Time.current, published_by: registered_manager)
  va = VisitAssignment.create!(visit: visit, employee: carers.sample, assigned_by: registered_manager)
  if state == :pending_review
    clock!(va, :clock_in, vstart + 2.minutes, geofence: :no_fix)
    va.update!(lifecycle_state: :pending_review, actual_start: vstart + 2.minutes)
  else
    va.update!(lifecycle_state: :missed)
  end
  Alerts::Raise.call(subject: va, alert_type: alert_type, severity: "high")
end
# A guaranteed in-progress visit (started 15 min ago) so the live board always
# shows an active call regardless of when the seed is run.
ip_su = ServiceUser.all.sample
ip_start = 15.minutes.ago
ip_visit = Visit.create!(service_user: ip_su, scheduled_start: ip_start, scheduled_end: ip_start + 45.minutes,
                         status: :published, published_at: Time.current, published_by: registered_manager)
clock_in_only!(VisitAssignment.create!(visit: ip_visit, employee: carers.sample, assigned_by: registered_manager))

puts "#{Alert.where(state: :open).count} open alerts; #{Notification.count} notifications; #{VisitAssignment.in_progress.count} in progress."

# ---------------------------------------------------------------------------
# Timesheets: build + approve last week's attendance, raise one dispute
# ---------------------------------------------------------------------------
period = Timesheets::BuildPeriod.call(starts_on: week_start - 7)
Timesheets::ApprovePeriod.call(period, finance_admin)
if (line = period.timesheet_lines.first)
  Timesheets::RaiseDispute.call(line: line, employee: line.employee, reason: "I stayed ~15 min longer than recorded.")
end
puts "Timesheet period #{period.starts_on}..#{period.ends_on}: #{period.status}, #{period.timesheet_lines.count} lines."

# ---------------------------------------------------------------------------
# Chat: a 1-to-1 (admin <-> carer) and a group thread
# ---------------------------------------------------------------------------
direct = Messaging::CreateConversation.direct(creator: registered_manager, other: carers.first)
Messaging::SendMessage.call(conversation: direct, sender: registered_manager,
                            body: "Morning Aisha — can you pick up the 17:00 at Cora's today?", client_message_id: SecureRandom.uuid)
Messaging::SendMessage.call(conversation: direct, sender: carers.first,
                            body: "Yes, no problem 👍", client_message_id: SecureRandom.uuid)

group = Messaging::CreateConversation.group(creator: registered_manager, title: "South team", participants: carers.first(3))
Messaging::SendMessage.call(conversation: group, sender: registered_manager,
                            body: "Team catch-up Friday 9am at the office.", client_message_id: SecureRandom.uuid)
puts "#{Conversation.count} conversations, #{Message.count} messages."

# ---------------------------------------------------------------------------
# Summary + credentials
# ---------------------------------------------------------------------------
puts "\n" + ("=" * 64)
puts "Seed complete. Login password for everyone: #{DEMO_PASSWORD}"
puts "-" * 64
puts "Admins  (POST /api/v1/admin/auth/login):"
Admin.order(:id).each { |a| puts "  #{a.role.to_s.ljust(20)} #{a.email}" }
puts "Carers  (POST /api/v1/staff/auth/login):"
Employee.order(:id).each { |e| puts "  #{e.role.to_s.ljust(20)} #{e.email}" }
puts "=" * 64
