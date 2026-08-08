# Best Pinnacle Care — FULL-YEAR demo seed (standalone).
#
# Separate from db/seeds.rb on purpose. Run it explicitly:
#
#   bin/rails runner db/seeds/full_year.rb
#   FORCE_SEED=1 RAILS_ENV=production bin/rails runner db/seeds/full_year.rb
#
# Tune with env vars:
#   SEED_MONTHS         how many months of history to build   (default 12)
#   SEED_SERVICE_USERS  how many people we support             (default 10, max 16)
#
# Builds ~a year of visits from recurring care packages, assigns 10 carers,
# simulates realistic clocking (completed / late / missed / geo-anomaly), builds
# and approves weekly timesheets across the whole window, and layers on live
# demo state (open alerts, an in-progress visit, chat, cover, carer requests,
# audit). Wipes first, so it is safe to re-run. Refuses production without
# FORCE_SEED=1. Clock events are bulk-inserted, so a full year seeds quickly.

require "securerandom"

abort "Refusing to seed production without FORCE_SEED=1" if Rails.env.production? && ENV["FORCE_SEED"].blank?

MONTHS   = Integer(ENV.fetch("SEED_MONTHS", "12"))
SU_COUNT = Integer(ENV.fetch("SEED_SERVICE_USERS", "10"))
PASSWORD   = "Password123!".freeze
MFA_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP".freeze # add once to an authenticator app → codes for every login

now         = Time.current
today       = Date.current
window_from = today - MONTHS.months
window_to   = today + 14 # two weeks of future scheduled visits

# ---------------------------------------------------------------------------
# Reset (clock_events/events are append-only, so TRUNCATE, never DELETE)
# ---------------------------------------------------------------------------
tables = %w[
  visit_notes visit_tasks care_plan_items employee_availabilities mileage_claims
  clock_events events visit_assignments visits care_package_slots service_users
  cover_offers carer_requests
  timesheet_disputes timesheet_lines timesheet_periods
  message_receipts message_attachments messages conversation_participants conversations
  notifications notification_preferences alerts
  refresh_tokens devices webauthn_credentials jwt_denylist
  employees admins settings
]
ActiveRecord::Base.connection.execute("TRUNCATE #{tables.join(', ')} RESTART IDENTITY CASCADE")
puts "Cleared existing data. Building #{MONTHS} months from #{window_from} to #{window_to}."

# Quiet + fast: silence SQL logging for the bulk build, restore at the end.
prev_logger = ActiveRecord::Base.logger
ActiveRecord::Base.logger = nil

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
# Admin (one) — MFA on, pre-enrolled with MFA_SECRET
# ---------------------------------------------------------------------------
manager = Admin.create!(
  email: "manager@bestpinnacle.test", password: PASSWORD, first_name: "Rebecca", last_name: "Hartley",
  role: :registered_manager, active: true, accepted_invite_at: 1.year.ago,
  mfa_enabled: true, mfa_confirmed_at: Time.current, mfa_secret: MFA_SECRET
)

# ---------------------------------------------------------------------------
# Carers (ten) — first two senior
# ---------------------------------------------------------------------------
CARER_NAMES = [
  %w[Aisha Khan], %w[Marcus Bell], %w[Priya Nair], %w[Tomasz Kowalski], %w[Grace Adeyemi],
  %w[Liam Doherty], %w[Sofia Rossi], %w[Daniel Owusu], %w[Chloe Bennett], %w[Ahmed Farah]
].freeze

carers = CARER_NAMES.each_with_index.map do |(first, last), i|
  Employee.create!(
    email: "#{first.downcase}@bestpinnacle.test", password: PASSWORD,
    first_name: first, last_name: last, role: (i < 2 ? :senior_carer : :carer),
    employee_reference: "EMP#{1001 + i}", active: true, accepted_invite_at: 1.year.ago,
    mfa_enabled: true, mfa_confirmed_at: Time.current, mfa_secret: MFA_SECRET,
    phone: format("07700 9%05d", i), hourly_rate_pence: rand(1150..1550), mileage_rate_pence: 45,
    contracted_hours_per_week: [ 20, 30, 37.5, 40 ].sample,
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
# Service users (people we support) — homes around south/central Manchester
# ---------------------------------------------------------------------------
HOMES = [
  [ "Ada",    "Whitfield", "14 Elm Grove",      "Didsbury",    "M20 2XY", 53.4109, -2.2310 ],
  [ "Bert",   "Holloway",  "3 Oak Lane",        "Chorlton",    "M21 9PQ", 53.4426, -2.2790 ],
  [ "Cora",   "Bassett",   "27 Birch Road",     "Withington",  "M20 4LP", 53.4330, -2.2280 ],
  [ "Dennis", "Ng",        "5 Maple Close",     "Fallowfield", "M14 6RT", 53.4420, -2.2190 ],
  [ "Edith",  "Ramsay",    "41 Cedar Avenue",   "Burnage",     "M19 1AA", 53.4270, -2.2010 ],
  [ "Frank",  "Osei",      "8 Willow Terrace",  "Levenshulme", "M19 3PP", 53.4400, -2.1900 ],
  [ "Gloria", "Pemberton", "12 Sycamore Drive", "Heaton Moor", "SK4 4AB", 53.4180, -2.1770 ],
  [ "Harold", "Mensah",    "9 Ash Street",      "Rusholme",    "M14 5TG", 53.4500, -2.2230 ],
  [ "Iris",   "Cavendish", "22 Poplar Way",     "Whalley Range", "M16 8FT", 53.4460, -2.2560 ],
  [ "Joseph", "Ali",       "7 Rowan Court",     "Old Trafford", "M16 0DZ", 53.4560, -2.2810 ],
  [ "Kathleen", "Byrne",   "31 Hazel Grove",    "Stretford",   "M32 8QT", 53.4470, -2.3080 ],
  [ "Leonard", "Fitzgerald", "4 Beech Mount",   "Sale",        "M33 3AA", 53.4250, -2.3220 ],
  [ "Mabel",  "Okafor",    "18 Alder Close",    "Northenden",  "M22 4BX", 53.4020, -2.2610 ],
  [ "Norman", "Sutcliffe", "6 Hawthorn Rise",   "Gatley",      "SK8 4NB", 53.3910, -2.2340 ],
  [ "Olive",  "Chukwu",    "25 Linden Avenue",  "Sale Moor",   "M33 2GH", 53.4180, -2.3090 ],
  [ "Percy",  "Hardcastle", "10 Chestnut Walk", "Cheadle",     "SK8 1AA", 53.3960, -2.2110 ]
].first([ SU_COUNT, 16 ].min).freeze

service_users = HOMES.map do |first, last, addr, city, pc, lat, lng|
  ServiceUser.create!(
    first_name: first, last_name: last, address_line1: addr, city: city, postcode: pc,
    lat: lat, lng: lng, geofence_radius_m: 150, active: true,
    date_of_birth: Date.new(rand(1935..1955), rand(1..12), rand(1..28)),
    phone: "0161 555 0#{rand(100..999)}",
    access_notes: "Key safe by the front door; code on file. Ring the bell and wait."
  )
end
puts "1 admin, #{carers.size} carers, #{service_users.size} people we support."

# ---------------------------------------------------------------------------
# Care packages (recurring calls) — effective for the whole window
# ---------------------------------------------------------------------------
CALLS = [
  [ "Morning call", "08:00", "08:45" ],
  [ "Lunch call",   "12:00", "12:30" ],
  [ "Tea call",     "17:00", "17:45" ],
  [ "Bedtime call", "21:00", "21:30" ]
].freeze

CARE_PLAN = [
  [ "medication", "Morning medication",   "Blister pack in the kitchen drawer." ],
  [ "mobility",   "Assist to armchair",   "Uses a Zimmer frame; take it slowly." ],
  [ "nutrition",  "Prepare a light meal", "Soft foods; watch for choking." ],
  [ "allergy",    "Penicillin allergy",   "Flag on all records." ]
].freeze

service_users.each do |su|
  CALLS.first(rand(2..4)).each do |name, start_t, end_t|
    CarePackageSlot.create!(service_user: su, name: name, start_time: start_t, end_time: end_t,
                            recurrence: "daily", staff_required: 1, break_minutes: 0,
                            effective_from: window_from, active: true)
  end
  CARE_PLAN.first(rand(2..4)).each_with_index do |(cat, label, detail), pos|
    su.care_plan_items.create!(category: cat, label: label, detail: detail, position: pos)
  end
end

# ---------------------------------------------------------------------------
# Generate a year of visits from the care packages, then publish them all
# ---------------------------------------------------------------------------
ActiveRecord::Base.transaction do
  Visits::GenerateFromCarePackages.call(from: window_from, to: window_to)
end
Visit.where(status: "draft").update_all(status: "published", published_at: now, published_by_admin_id: manager.id)
puts "#{Visit.count} visits generated + published."

# ---------------------------------------------------------------------------
# Assign carers and simulate clocking across the whole window.
#   past    → mostly completed (a few late), some missed, some geo pending-review
#   now     → in progress
#   future  → scheduled
# Assignments are bulk-inserted; clock events are bulk-inserted (RETURNING maps
# each visit to its new assignment id), so the whole year lands in seconds.
# ---------------------------------------------------------------------------
assignment_rows = []
plan_by_visit   = {} # visit_id => { emp_id:, su_lat:, su_lng:, clocks: [{kind:, at:, geo:}] }
idx = 0

Visit.includes(:service_user).find_each(batch_size: 2000) do |v|
  emp = carers[idx % carers.size]
  idx += 1
  su  = v.service_user

  row = {
    visit_id: v.id, employee_id: emp.id, assigned_by_admin_id: manager.id,
    assignment_status: "assigned", role: "worker", flags: [],
    lifecycle_state: "scheduled", actual_start: nil, actual_end: nil, worked_minutes: nil,
    created_at: now, updated_at: now
  }
  clocks = []

  if v.scheduled_end < now
    recent = v.scheduled_end > (now - 14.days) # older exceptions are long resolved
    roll = rand
    if roll < 0.03 # missed — no clock at all
      row[:lifecycle_state] = "missed"
    elsif recent && roll < 0.09 # arrived but no GPS fix → awaits a manager decision (recent only)
      ci = v.scheduled_start + rand(1..5).minutes
      row.merge!(lifecycle_state: "pending_review", actual_start: ci)
      clocks << { kind: "clock_in", at: ci, geo: "no_fix" }
    else # completed (a slice of them noticeably late)
      late = roll < 0.13
      ci = v.scheduled_start + (late ? rand(16..45) : rand(-4..8)).minutes
      co = v.scheduled_end + rand(-8..6).minutes
      row.merge!(lifecycle_state: "completed", actual_start: ci, actual_end: co,
                 worked_minutes: ((co - ci) / 60).round, flags: (late ? [ "late" ] : []))
      clocks << { kind: "clock_in",  at: ci, geo: "pass" }
      clocks << { kind: "clock_out", at: co, geo: "pass" }
    end
  elsif v.scheduled_start < now # spans now → in progress
    ci = v.scheduled_start + rand(-2..4).minutes
    row.merge!(lifecycle_state: "in_progress", actual_start: ci)
    clocks << { kind: "clock_in", at: ci, geo: "pass" }
  end

  assignment_rows << row
  plan_by_visit[v.id] = { emp_id: emp.id, su_lat: su.lat, su_lng: su.lng, clocks: clocks }
end

va_id_by_visit = {}
assignment_rows.each_slice(2000) do |slice|
  VisitAssignment.insert_all!(slice, returning: %w[id visit_id]).rows.each do |id, visit_id|
    va_id_by_visit[visit_id] = id
  end
end

clock_rows = []
plan_by_visit.each do |visit_id, p|
  va_id = va_id_by_visit[visit_id]
  p[:clocks].each do |c|
    clock_rows << {
      visit_assignment_id: va_id, kind: c[:kind], occurred_at: c[:at], recorded_at: c[:at],
      method: "gps", geofence_result: c[:geo], lat: p[:su_lat], lng: p[:su_lng],
      distance_from_site_m: (c[:geo] == "pass" ? rand(5..70) : nil),
      device_fingerprint: SecureRandom.uuid, client_event_id: SecureRandom.uuid,
      created_by_id: p[:emp_id], created_by_type: "Employee"
    }
  end
end
clock_rows.each_slice(5000) { |slice| ClockEvent.insert_all!(slice) }
puts "#{VisitAssignment.count} assignments; #{ClockEvent.count} clock events " \
     "(#{VisitAssignment.completed.count} completed, #{VisitAssignment.where(lifecycle_state: :missed).count} missed, " \
     "#{VisitAssignment.where(lifecycle_state: :pending_review).count} pending review)."

# ---------------------------------------------------------------------------
# Timesheets: build a weekly period for every past week, approve the settled
# ones (periods with a pending-review or auto-closed line stay open, as in real
# use — those must be resolved before approval).
# ---------------------------------------------------------------------------
approved = 0
wk = window_from.beginning_of_week
last_full_week = (today - 7).beginning_of_week
while wk <= last_full_week
  period = Timesheets::BuildPeriod.call(starts_on: wk)
  approved += 1 if Timesheets::ApprovePeriod.call(period, manager).ok
  wk += 7
end
puts "#{TimesheetPeriod.count} weekly timesheet periods (#{approved} approved); #{TimesheetLine.count} lines."

# A dispute on a recent approved line, so the disputes queue has something real.
recent_line = TimesheetLine.joins(:timesheet_period)
                           .where(timesheet_periods: { status: "approved" })
                           .order("timesheet_periods.starts_on DESC").first
if recent_line
  Timesheets::RaiseDispute.call(line: recent_line, employee: recent_line.employee,
                                reason: "I stayed ~15 min longer than recorded.")
end

# ---------------------------------------------------------------------------
# Live demo state — a guaranteed in-progress visit + open exceptions today, so
# the live board and exceptions queue always show something regardless of when
# this runs.
# ---------------------------------------------------------------------------
def clock_now!(va, kind, at, geo)
  su = va.visit.service_user
  ClockEvent.create!(visit_assignment: va, kind: kind, occurred_at: at, recorded_at: at, method: "gps",
                     lat: su.lat, lng: su.lng, geofence_result: geo,
                     distance_from_site_m: (geo == :pass ? rand(5..70) : nil),
                     device_fingerprint: SecureRandom.uuid, client_event_id: SecureRandom.uuid, created_by: va.employee)
end

ip_start = 15.minutes.ago
ip_visit = Visit.create!(service_user: service_users.sample, scheduled_start: ip_start, scheduled_end: ip_start + 45.minutes,
                         status: :published, published_at: now, published_by: manager)
ip_va = VisitAssignment.create!(visit: ip_visit, employee: carers.sample, assigned_by: manager)
clock_now!(ip_va, :clock_in, ip_start + 2.minutes, :pass)
ip_va.update!(lifecycle_state: :in_progress, actual_start: ip_start + 2.minutes)

[ [ :missed, "missed_visit" ], [ :pending_review, "geo_anomaly" ] ].each_with_index do |(state, alert_type), i|
  vstart = (2 + i).hours.ago
  visit  = Visit.create!(service_user: service_users.sample, scheduled_start: vstart, scheduled_end: vstart + 45.minutes,
                         status: :published, published_at: now, published_by: manager)
  va = VisitAssignment.create!(visit: visit, employee: carers.sample, assigned_by: manager)
  if state == :pending_review
    clock_now!(va, :clock_in, vstart + 2.minutes, :no_fix)
    va.update!(lifecycle_state: :pending_review, actual_start: vstart + 2.minutes)
  else
    va.update!(lifecycle_state: :missed)
  end
  Alerts::Raise.call(subject: va, alert_type: alert_type, severity: "high")
end
puts "#{Alert.where(state: :open).count} open alerts; #{Notification.count} notifications."

# ---------------------------------------------------------------------------
# Chat — a 1-to-1, a group, and a broadcast channel
# ---------------------------------------------------------------------------
direct = Messaging::CreateConversation.direct(creator: manager, other: carers.first)
Messaging::SendMessage.call(conversation: direct, sender: manager,
                            body: "Morning #{carers.first.first_name} — can you pick up the 17:00 at Cora's today?", client_message_id: SecureRandom.uuid)
Messaging::SendMessage.call(conversation: direct, sender: carers.first,
                            body: "Yes, no problem 👍", client_message_id: SecureRandom.uuid)

group = Messaging::CreateConversation.group(creator: manager, title: "South team", participants: carers.first(5))
Messaging::SendMessage.call(conversation: group, sender: manager,
                            body: "Team catch-up Friday 9am at the office.", client_message_id: SecureRandom.uuid)

channel = Messaging::CreateConversation.channel(creator: manager, title: "#all-carers", participants: carers)
Messaging::SendMessage.call(conversation: channel, sender: manager, broadcast: true,
                            body: "Reminder: supervision sign-off is due Friday. Tap to acknowledge.", client_message_id: SecureRandom.uuid)
puts "#{Conversation.count} conversations, #{Message.count} messages."

# ---------------------------------------------------------------------------
# Cover board — unfilled visits over the next few days, one with a pending offer
# ---------------------------------------------------------------------------
open_visits = Array.new(5) do |i|
  start = now.beginning_of_day + (i + 1).days + [ 8, 12, 17, 20, 9 ][i].hours
  Visit.create!(service_user: service_users.sample, scheduled_start: start, scheduled_end: start + 1.hour,
                status: :published, published_at: now, published_by: manager,
                notes: [ "Morning call — personal care and breakfast.", "Lunch and welfare check.",
                        "Tea and evening medication.", "Bedtime settle.", "Welfare check." ][i])
end
CoverOffer.create!(visit: open_visits.first, employee: carers.sample, offered_by: manager, state: "pending")
puts "#{open_visits.size} unfilled visits on the cover board; #{CoverOffer.count} offers."

# ---------------------------------------------------------------------------
# Carer requests queue
# ---------------------------------------------------------------------------
[
  { kind: "swap",     summary: "Swap Friday 08:00 visit with a colleague", detail: "Happy for anyone trained on the client to take it.", payload: { day: "Friday", time: "08:00" } },
  { kind: "leave",    summary: "Annual leave next month", detail: "Five weekday visits fall in this window.", payload: { visits_affected: 5 } },
  { kind: "overtime", summary: "Available for extra weekend hours", detail: "Up to 8 extra hours this weekend.", payload: { extra_hours: 8 } },
  { kind: "drop",     summary: "Drop Thursday 20:00 visit", detail: "Can no longer make the Thursday bedtime call.", payload: { day: "Thursday", time: "20:00" } }
].each_with_index do |r, i|
  CarerRequest.create!(employee: carers[i % carers.size], state: "pending", **r)
end
puts "#{CarerRequest.pending.count} carer requests waiting."

# ---------------------------------------------------------------------------
# Audit trail — mirror what the controllers write, so the Audit page runs on
# real events spread across the window.
# ---------------------------------------------------------------------------
Events::Record.call(aggregate: Setting.instance, actor: manager, event_type: "settings.updated",
                    payload: { changed: %w[late_grace_minutes geofence_radius_m] }, occurred_at: 2.days.ago)

VisitAssignment.assigned.completed.order("id DESC").limit(5).each_with_index do |va, i|
  Events::Record.call(aggregate: va, actor: manager, event_type: "assignment.created",
                      payload: { visit_id: va.visit_id, employee_id: va.employee_id, employee_name: va.employee&.full_name },
                      occurred_at: (i + 1).hours.ago)
end

if (done_va = VisitAssignment.completed.order("id DESC").first)
  Events::Record.call(aggregate: done_va, actor: manager, event_type: "clock.corrected",
                      payload: { kind: "clock_out", reason: "Carer confirmed by phone; battery died" }, occurred_at: 90.minutes.ago)
end

if (last_period = TimesheetPeriod.where(status: "approved").order(:starts_on).last)
  Events::Record.call(aggregate: last_period, actor: manager, event_type: "timesheet.approved",
                      payload: { starts_on: last_period.starts_on, ends_on: last_period.ends_on }, occurred_at: 3.hours.ago)
end

if (offer = CoverOffer.first)
  Events::Record.call(aggregate: offer.visit, actor: manager, event_type: "cover.offered",
                      payload: { employee_id: offer.employee_id, employee_name: offer.employee&.full_name }, occurred_at: 40.minutes.ago)
end
puts "#{Event.count} audit events recorded."

# ---------------------------------------------------------------------------
# Summary + credentials
# ---------------------------------------------------------------------------
ActiveRecord::Base.logger = prev_logger
puts "\n" + ("=" * 64)
puts "Full-year seed complete (#{window_from}..#{window_to}). Password for everyone: #{PASSWORD}"
puts "MFA secret for every login (add to an authenticator app): #{MFA_SECRET}"
puts "-" * 64
puts "Admin  (POST /api/v1/admin/auth/login):  #{manager.email}"
puts "Carers (POST /api/v1/staff/auth/login):"
Employee.order(:id).each { |e| puts "  #{e.role.to_s.ljust(14)} #{e.email}" }
puts "=" * 64
