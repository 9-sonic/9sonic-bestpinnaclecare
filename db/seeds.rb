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
# Fixed TOTP secret both demo users are enrolled with — add it once to an
# authenticator app and it generates valid MFA codes for either login.
DEMO_MFA_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP".freeze

# ---------------------------------------------------------------------------
# Reset (clock_events/events are append-only, so TRUNCATE, never DELETE)
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
# Admin (one) — MFA off for testing (secret retained; set mfa_enabled: true +
# mfa_confirmed_at to re-enable the two-step login).
# ---------------------------------------------------------------------------
admins = {
  registered_manager: [ "Rebecca", "Hartley", "manager@bestpinnacle.test" ]
}.map do |role, (first, last, email)|
  Admin.create!(email: email, password: DEMO_PASSWORD, first_name: first, last_name: last,
                role: role, active: true, accepted_invite_at: 30.days.ago,
                mfa_enabled: false, mfa_confirmed_at: nil, mfa_secret: DEMO_MFA_SECRET)
end
registered_manager = admins.first
finance_admin = admins.find(&:finance?) || registered_manager

# ---------------------------------------------------------------------------
# Employees (carers)
# ---------------------------------------------------------------------------
carers = [
  %w[Aisha Khan]
].each_with_index.map do |(first, last), i|
  Employee.create!(
    email: "#{first.downcase}@bestpinnacle.test", password: DEMO_PASSWORD,
    first_name: first, last_name: last, role: :carer,
    employee_reference: "EMP#{1001 + i}", active: true, accepted_invite_at: 25.days.ago,
    mfa_enabled: false,
    phone: "07700 9000#{i}#{i}", hourly_rate_pence: rand(1150..1450), mileage_rate_pence: 45,
    contracted_hours_per_week: [ 30, 37.5, 40 ].sample,
    emergency_contact_name: "Next of kin", emergency_contact_phone: "0161 555 0#{rand(100..999)}"
  )
end

# Standing weekly availability
carers.each do |c|
  (0..6).each do |weekday|
    %w[morning afternoon evening].each do |slot|
      c.employee_availabilities.create!(weekday: weekday, slot: slot, available: [ true, true, false ].sample)
    end
  end
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

CARE_PLAN = [
  [ "medication", "Morning medication",  "Blister pack in the kitchen drawer." ],
  [ "mobility",   "Assist to armchair",  "Uses a Zimmer frame; take it slowly." ],
  [ "nutrition",  "Prepare a light meal", "Soft foods; watch for choking." ],
  [ "allergy",    "Penicillin allergy",  "Flag on all records." ]
].freeze

ServiceUser.find_each do |su|
  CALLS.first(rand(2..4)).each do |name, start_t, end_t|
    CarePackageSlot.create!(service_user: su, name: name, start_time: start_t, end_time: end_t,
                            recurrence: "daily", staff_required: 1, break_minutes: 0,
                            effective_from: 30.days.ago.to_date, active: true)
  end
  CARE_PLAN.first(rand(2..4)).each_with_index do |(cat, label, detail), pos|
    su.care_plan_items.create!(category: cat, label: label, detail: detail, position: pos)
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

channel = Messaging::CreateConversation.channel(creator: registered_manager, title: "#north-team", participants: carers)
Messaging::SendMessage.call(conversation: channel, sender: registered_manager, broadcast: true,
                            body: "Reminder: supervision sign-off is due Friday. Tap to acknowledge.", client_message_id: SecureRandom.uuid)
puts "#{Conversation.count} conversations (#{Conversation.where(kind: :channel).count} channels), #{Message.count} messages."

# ---------------------------------------------------------------------------
# Cover board: a few unfilled published visits in the next few days, one with
# a pending offer out to a carer.
# ---------------------------------------------------------------------------
open_visits = Array.new(4) do |i|
  start = now.beginning_of_day + (i + 1).days + [ 8, 12, 17, 20 ][i].hours
  Visit.create!(service_user: ServiceUser.all.sample, scheduled_start: start, scheduled_end: start + 1.hour,
                status: :published, published_at: Time.current, published_by: registered_manager,
                notes: [ "Morning call — personal care and breakfast.", "Lunch and welfare check.",
                        "Tea and evening medication.", "Bedtime settle." ][i])
end
CoverOffer.create!(visit: open_visits.first, employee: carers.sample, offered_by: registered_manager, state: "pending")
puts "#{open_visits.size} unfilled visits on the cover board; #{CoverOffer.count} offers."

# ---------------------------------------------------------------------------
# Carer requests queue
# ---------------------------------------------------------------------------
[
  { kind: "swap",     summary: "Swap Friday 08:00 visit with a colleague", detail: "Happy for anyone trained on the client to take it.", payload: { day: "Friday", time: "08:00" } },
  { kind: "leave",    summary: "Annual leave 12–16 August", detail: "Five weekday visits fall in this window.", payload: { from: "12 Aug", to: "16 Aug", visits_affected: 5 } },
  { kind: "overtime", summary: "Available for extra weekend hours", detail: "Up to 8 extra hours this weekend.", payload: { extra_hours: 8 } },
  { kind: "drop",     summary: "Drop Thursday 20:00 visit", detail: "Can no longer make the Thursday bedtime call.", payload: { day: "Thursday", time: "20:00" } }
].each_with_index do |r, i|
  CarerRequest.create!(employee: carers[i % carers.size], state: "pending", **r)
end
puts "#{CarerRequest.pending.count} carer requests waiting."

# ---------------------------------------------------------------------------
# Audit trail — record events for the seeded actions, mirroring what the
# controllers write in real use, so the Audit page runs on real data.
# ---------------------------------------------------------------------------
Events::Record.call(aggregate: Setting.instance, actor: registered_manager, event_type: "settings.updated",
                    payload: { changed: %w[late_grace_minutes geofence_radius_m] }, occurred_at: 2.days.ago)

VisitAssignment.assigned.includes(:visit, :employee).limit(5).each_with_index do |va, i|
  Events::Record.call(aggregate: va, actor: registered_manager, event_type: "assignment.created",
                      payload: { visit_id: va.visit_id, employee_id: va.employee_id, employee_name: va.employee&.full_name },
                      occurred_at: (i + 1).hours.ago)
end

if (done_va = VisitAssignment.completed.first)
  Events::Record.call(aggregate: done_va, actor: registered_manager, event_type: "clock.corrected",
                      payload: { kind: "clock_out", reason: "Carer confirmed by phone; battery died" }, occurred_at: 90.minutes.ago)
end

Events::Record.call(aggregate: period, actor: finance_admin, event_type: "timesheet.approved",
                    payload: { starts_on: period.starts_on, ends_on: period.ends_on }, occurred_at: 3.hours.ago)

if (offer = CoverOffer.first)
  Events::Record.call(aggregate: offer.visit, actor: registered_manager, event_type: "cover.offered",
                      payload: { employee_id: offer.employee_id, employee_name: offer.employee&.full_name }, occurred_at: 40.minutes.ago)
end

puts "#{Event.count} audit events recorded."

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
