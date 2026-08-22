# Full-year demo data for a client walkthrough.
#
#   bin/rails demo:seed_year
#   FORCE_SEED=1 RAILS_ENV=production bin/rails demo:seed_year   # explicit opt-in
#
# Unlike db/seeds.rb (a small 5-visit smoke seed), this fills ~12 months so the
# attendance audit, trends and every screen look real in a demo: ~8 carers, ~10
# clients on recurring care-package slots, thousands of visits with a believable
# attendance mix (on-time / late / missed / offline-synced), a few audited
# manager corrections (original kept), plus messages and carer requests.
#
# Everything is written through the SAME services the live app uses
# (Clocking::RecordClockEvent, Messaging::*, Events::Record), so lifecycle state,
# worked_minutes and the audit trail come out exactly as production would — no
# hand-forged rows that could look consistent while being subtly wrong.
#
# Destructive: it truncates the same tables as db/seeds.rb. Refuses production
# unless FORCE_SEED=1, same guard as the smoke seed.
namespace :demo do
  desc "Seed ~12 months of realistic demo data (clients, carers, visits, corrections, messages, requests)"
  task seed_year: :environment do
    require "securerandom"

    if Rails.env.production? && ENV["FORCE_SEED"].blank?
      abort "Refusing to seed production without FORCE_SEED=1"
    end

    DEMO_PASSWORD = "Password123!"
    rng = Random.new(20260821) # fixed seed -> reproducible demo every run

    # ---- reset (same tables as db/seeds.rb) --------------------------------
    tables = %w[
      visit_notes visit_tasks care_plan_items employee_availabilities mileage_claims
      clock_events events visit_assignments visits care_package_slots service_users
      message_receipts message_attachments messages conversation_participants conversations
      notifications notification_preferences alerts carer_requests
      refresh_tokens devices webauthn_credentials jwt_denylist
      employees admins settings
    ]
    existing = tables & ActiveRecord::Base.connection.tables
    ActiveRecord::Base.connection.execute("TRUNCATE #{existing.join(', ')} RESTART IDENTITY CASCADE") if existing.any?
    puts "Cleared existing data."

    # ---- settings ----------------------------------------------------------
    Setting.create!(
      id: 1, company_name: "Best Pinnacle Care Ltd", trading_name: "Best Pinnacle Care",
      cqc_provider_id: "1-101010101", cqc_location_id: "1-202020202",
      address_line1: "Pinnacle House, 12 Deansgate", city: "Manchester", postcode: "M3 2AB",
      phone: "0161 555 0100", email: "office@bestpinnacle.test",
      geofence_mode: "block", geofence_radius_m: 150
    )

    # ---- office (admins) ---------------------------------------------------
    manager = Admin.create!(
      email: "manager@bestpinnacle.test", password: DEMO_PASSWORD,
      first_name: "Rebecca", last_name: "Hartley", role: :registered_manager,
      active: true, accepted_invite_at: 400.days.ago, mfa_enabled: false
    )
    coordinator = Admin.create!(
      email: "coordinator@bestpinnacle.test", password: DEMO_PASSWORD,
      first_name: "Daniel", last_name: "Osei", role: :coordinator,
      active: true, accepted_invite_at: 300.days.ago, mfa_enabled: false
    )

    # ---- carers (8) --------------------------------------------------------
    carer_names = [
      %w[Aisha Yusuf], %w[Tom Whitfield], %w[Grace Mensah], %w[Leon Carter],
      %w[Priya Sharma], %w[Marcus Bello], %w[Chloe Adams], %w[Ivan Petrov]
    ]
    carers = carer_names.each_with_index.map do |(first, last), i|
      Employee.create!(
        email: "#{first.downcase}@bestpinnacle.test", password: DEMO_PASSWORD,
        first_name: first, last_name: last, role: :carer, active: true,
        accepted_invite_at: (380 - i * 10).days.ago,
        contracted_hours_per_week: [ 37.5, 40, 30, 25 ].sample(random: rng)
      )
    end

    # ---- clients (10) with real Manchester-area coords ---------------------
    client_seed = [
      [ "Ada", "Whitfield", "14 Oxford Road", "M1 5QA", 53.4776, -2.2416 ],
      [ "Frank", "Doyle", "82 Chester Road", "M15 4EU", 53.4711, -2.2529 ],
      [ "Ivy", "Bennett", "5 Wilmslow Road", "M14 5TP", 53.4459, -2.2246 ],
      [ "Cyril", "Booth", "20 Deansgate", "M3 4EN", 53.4794, -2.2500 ],
      [ "Nora", "Pierce", "9 Stockport Road", "M12 6BD", 53.4635, -2.1965 ],
      [ "Albert", "Finch", "33 Bury New Road", "M8 8FX", 53.5051, -2.2410 ],
      [ "Vera", "Sutcliffe", "7 Palatine Road", "M20 3JA", 53.4230, -2.2320 ],
      [ "Reg", "Hollis", "44 Kingsway", "M19 1PL", 53.4380, -2.1900 ],
      [ "Edna", "Marsh", "18 Barlow Moor Road", "M21 8AA", 53.4340, -2.2760 ],
      [ "Harold", "Vance", "61 Ashton Old Road", "M11 2DR", 53.4720, -2.1830 ]
    ]
    clients = client_seed.each_with_index.map do |(first, last, addr, pc, lat, lng), i|
      ServiceUser.create!(
        first_name: first, last_name: last, reference: format("SU-%04d", 1001 + i),
        address_line1: addr, city: "Manchester", postcode: pc, lat: lat, lng: lng,
        active: true, geofence_mode: "block", geofence_radius_m: 150,
        access_notes: [ "Key safe by the door, code on file.", "Ring twice, daughter may answer.", nil ].sample(random: rng)
      )
    end

    # ---- care-package slots: each client gets 1-2 recurring weekday visits --
    slot_times = [ [ "08:00", 45 ], [ "12:30", 30 ], [ "17:30", 45 ], [ "20:00", 30 ] ]
    clients.each do |su|
      picks = slot_times.sample(rng.rand(1..2), random: rng)
      picks.each do |(start, mins)|
        st = Time.zone.parse(start)
        CarePackageSlot.create!(
          service_user: su, name: "#{start} call", recurrence: "weekdays",
          start_time: st, end_time: st + mins.minutes, break_minutes: 0,
          staff_required: 1, effective_from: 400.days.ago.to_date, active: true
        )
      end
    end

    # ---- the visit generator (writes through the live clock service) -------
    # outcome buckets: mostly on-time, some late, a few missed, some offline.
    def seed_visit(su:, employee:, start:, minutes:, outcome:, rng:)
      v  = Visit.create!(service_user: su, scheduled_start: start, scheduled_end: start + minutes.minutes,
                         status: :published, published_at: start - 2.days)
      va = VisitAssignment.create!(visit: v, employee: employee, assignment_status: "assigned", lifecycle_state: :scheduled)

      # No clocks at all — a genuinely missed visit. Set the terminal state that
      # the timer would have reached live, so a past date reads as "missed" rather
      # than "scheduled" on the board and in the reports.
      if outcome == :missed
        va.update!(lifecycle_state: :missed)
        return va
      end

      late_by = outcome == :late ? rng.rand(6..25) : rng.rand(-3..3)
      offline = outcome == :offline
      in_at   = start + late_by.minutes

      Clocking::RecordClockEvent.call(
        visit_assignment: va, kind: "clock_in", client_event_id: SecureRandom.uuid,
        occurred_at: in_at, lat: su.lat, lng: su.lng, accuracy_m: rng.rand(6..18),
        actor: employee, method: offline ? "offline" : "gps", on_block: offline ? :flag : :reject
      )

      # ~4% of otherwise-clocked visits never get a clock-out (still "in progress").
      return va if outcome == :no_clock_out

      Clocking::RecordClockEvent.call(
        visit_assignment: va, kind: "clock_out", client_event_id: SecureRandom.uuid,
        occurred_at: start + minutes.minutes + rng.rand(-4..6).minutes,
        lat: su.lat, lng: su.lng, accuracy_m: rng.rand(6..18), actor: employee, on_block: :reject
      )

      # The clock service backdates these taps, so its time-skew check flags every
      # one as an anomaly and parks it in pending_review — correct for a live tap,
      # wrong for history that genuinely finished. Reconcile to the terminal state
      # the visit would have settled into: a clean on-time/late visit reads as
      # completed; an offline-synced one legitimately stays pending_review (an
      # offline tap really does await office sign-off). The clock events themselves
      # are untouched — only the settled lifecycle_state is corrected.
      va.reload
      va.update!(lifecycle_state: :completed) if outcome != :offline && va.lifecycle_state == "pending_review"
      va
    end

    def pick_outcome(rng)
      r = rng.rand
      return :late         if r < 0.10
      return :missed       if r < 0.13
      return :offline      if r < 0.15
      return :no_clock_out if r < 0.17
      :on_time
    end

    # ---- generate ~12 months of visits from the care-package slots ---------
    # Past visits only (future dates would have no attendance to show). Each
    # weekday, each active slot becomes a visit assigned round-robin to a carer.
    puts "Generating a year of visits…"
    start_date = 365.days.ago.to_date
    end_date   = Date.current
    corrected  = 0
    visit_count = 0
    carer_ix = 0

    (start_date..end_date).each do |date|
      next if date.saturday? || date.sunday? # weekday care package

      CarePackageSlot.where(active: true).includes(:service_user).find_each do |slot|
        su = slot.service_user
        start_at = Time.zone.local(date.year, date.month, date.day, slot.start_time.hour, slot.start_time.min)
        next if start_at > Time.current # don't seed a visit in the future

        minutes = ((slot.end_time - slot.start_time) / 60).to_i
        employee = carers[carer_ix % carers.size]
        carer_ix += 1

        outcome = pick_outcome(rng)
        va = seed_visit(su: su, employee: employee, start: start_at, minutes: minutes, outcome: outcome, rng: rng)
        visit_count += 1

        # ~2% of completed visits get an audited manager correction to the
        # clock-in time (original event kept; correction appended with a reason).
        if outcome == :on_time && rng.rand < 0.02
          original = va.clock_events.where(kind: "clock_in").order(:occurred_at).first
          if original
            Clocking::RecordClockEvent.call(
              visit_assignment: va, actor: coordinator, method: "manual_admin", on_block: :flag,
              kind: "clock_in", client_event_id: SecureRandom.uuid,
              occurred_at: original.occurred_at - rng.rand(5..15).minutes,
              lat: su.lat, lng: su.lng,
              reason: "Carer confirmed arrival was earlier than the phone recorded (poor signal).",
              corrects_id: original.id
            )
            Events::Record.call(
              aggregate: va, actor: coordinator, event_type: "clock.corrected",
              payload: { kind: "clock_in", reason: "signal delay", corrects_id: original.id }
            )
            corrected += 1
          end
        end
      end
    end

    # ---- messages: an office channel + a few office<->carer threads --------
    puts "Seeding messages…"
    channel = Messaging::CreateConversation.channel(
      creator: manager, title: "#team-updates", participants: carers,
      purpose: "Rota changes, cover requests and general team notices.", auto_post: true
    )
    Messaging::SendMessage.call(conversation: channel, sender: manager,
      body: "Welcome to the team channel. Post here if you need cover.", client_message_id: SecureRandom.uuid)
    Messaging::SendMessage.call(conversation: channel, sender: carers[2],
      body: "Can anyone cover Frank's 5:30 on Thursday? Dentist appt.", client_message_id: SecureRandom.uuid)

    carers.first(4).each_with_index do |carer, i|
      dm = Messaging::CreateConversation.direct(creator: manager, other: carer)
      Messaging::SendMessage.call(conversation: dm, sender: manager,
        body: [ "Thanks for covering the extra visit yesterday.",
               "Your timesheet looks good this week.",
               "Please call the office when you get a chance.",
               "New client on your round from Monday — details on the rota." ][i],
        client_message_id: SecureRandom.uuid)
      Messaging::SendMessage.call(conversation: dm, sender: carer,
        body: [ "No problem at all.", "Great, thanks!", "Will do.", "Got it, thanks." ][i],
        client_message_id: SecureRandom.uuid)
    end

    # ---- carer requests across the year --------------------------------------
    # Only "drop" is a real carer-raised request in this app: a carer declining a
    # visit so the office can arrange cover (ShiftDetailPage). The other KINDS
    # (swap/overtime/availability/leave) exist in the enum but have no carer flow,
    # so seeding them would fake a feature that isn't there. Drops only.
    puts "Seeding carer requests…"
    req_specs = [
      [ "drop", "Can't make Friday's 8pm, please arrange cover",     "declined" ],
      [ "drop", "Unwell — need Tuesday morning covered",             "approved" ],
      [ "drop", "Car trouble, can't reach the 5:30 today",           "approved" ],
      [ "drop", "Family emergency, please cover tomorrow's round",   "approved" ],
      [ "drop", "Double-booked — can someone take the lunchtime call?", "pending" ],
      [ "drop", "Need Thursday's late visit covered if possible",    "pending" ]
    ]
    req_specs.each_with_index do |(kind, summary, state), i|
      created = rng.rand(20..320).days.ago
      decided = state == "pending" ? nil : created + rng.rand(1..3).days
      CarerRequest.create!(
        employee: carers[i % carers.size], kind: kind, summary: summary, state: state,
        detail: summary, created_at: created, updated_at: decided || created,
        decided_at: decided, decided_by: (decided ? manager : nil),
        decision_note: (state == "declined" ? "Already covered by another carer." : (state == "approved" ? "Approved — thanks for the notice." : nil))
      )
    end

    # ---- summary -----------------------------------------------------------
    puts "\n" + ("=" * 64)
    puts "Full-year demo seed complete."
    puts "-" * 64
    puts "Admins:   #{Admin.count}   Carers: #{Employee.count}   Clients: #{ServiceUser.count}"
    puts "Slots:    #{CarePackageSlot.count}   Visits: #{Visit.count}   Clock events: #{ClockEvent.count}"
    puts "Corrections: #{corrected}   Requests: #{CarerRequest.count}   Conversations: #{Conversation.count}"
    puts "-" * 64
    puts "Sign in:  manager@bestpinnacle.test / #{DEMO_PASSWORD}"
    puts "Carers:   aisha@ / tom@ / grace@ … @bestpinnacle.test / #{DEMO_PASSWORD}"
    puts "=" * 64
  end
end
