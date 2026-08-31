require "digest"

module Seeding
  # Imports the real RoundSys export (staff, service users, historical visits +
  # clock events) from the checked-in JSON in db/seed_data.
  #
  # Runs in one of two modes:
  #
  #   additive (default) — creates ONLY what's missing and never truncates. Staff
  #     and service users are found-or-created by their natural key (email / name);
  #     a visit is skipped if it's already been imported. Safe to run on every
  #     deploy and every time a fresh batch of history is dropped into the JSON —
  #     it tops up without touching real clock-ins the carers made live. This is
  #     the mode the deploy uses.
  #
  #   wipe — the one-time initial load (db/seeds.rb): the caller truncates first,
  #     then this fills an empty DB.
  #
  # Idempotency hinges on a DETERMINISTIC client_event_id per tap, derived from
  # (carer, client, occurred_at, kind). Re-importing the same row yields the same
  # id, and ClockEvent is unique on client_event_id — so a re-run finds the visit
  # already there and moves on. (The old code minted a random UUID per run, which
  # made re-runs duplicate everything.)
  class RoundsysImport
    # A fixed, arbitrary UUID namespace for deterministic v5 tap ids. uuid_v5
    # requires the namespace to itself be a UUID (not a plain string).
    NAMESPACE = "5f9d2c7e-1a3b-4e6d-8c0f-2b7a4d1e9c30"

    Result = Struct.new(:carers, :service_users, :visits, :skipped, :deactivated, keyword_init: true)

    def self.call(...) = new(...).call

    def initialize(people_path: nil, visits_path: nil, password: "Password123!")
      root = defined?(Rails) ? Rails.root : Pathname.pwd
      @people = JSON.parse(File.read(people_path || root.join("db/seed_data/roundsys.json")))
      @visits = JSON.parse(File.read(visits_path || root.join("db/seed_data/roundsys_visits.json")))
      @password = password
      @res = Result.new(carers: 0, service_users: 0, visits: 0, skipped: 0, deactivated: 0)
    end

    def call
      import_carers
      import_service_users
      import_deactivated_carers
      import_visits
      @res
    end

    # Staff + service users only — the fast path for a routine (no-visits) seed.
    def call_people_only
      import_carers
      import_service_users
      @res
    end

    private

    # A stable UUID for a tap, so the same export row always maps to the same
    # clock event — the key to safe re-runs.
    def event_id(carer_email, su, occurred_at, kind)
      Digest::UUID.uuid_v5(NAMESPACE, [ carer_email, su, occurred_at, kind ].join("|"))
    end

    def import_carers
      @people["employees"].each do |e|
        next if Employee.exists?(email: e["email"])

        Employee.create!(
          email: e["email"], password: @password,
          first_name: e["first_name"], last_name: e["last_name"], phone: e["phone"],
          role: :carer, # leave employee_reference unset -> model assigns EMP-XXXX
          emergency_contact_name: e["emergency_contact_name"],
          emergency_contact_phone: e["emergency_contact_phone"],
          contracted_hours_per_week: e["contracted_hours_per_week"],
          active: true, accepted_invite_at: Time.current
        )
        @res.carers += 1
      end
    end

    def import_service_users
      @people["service_users"].each do |su|
        next if ServiceUser.exists?(first_name: su["first_name"], last_name: su["last_name"])

        ServiceUser.create!(
          first_name: su["first_name"], last_name: su["last_name"],
          council_id: su["reference"], # our SU- reference is auto-assigned by the model
          date_of_birth: su["date_of_birth"], address_line1: su["address_line1"],
          postcode: su["postcode"], lat: su["lat"], lng: su["lng"], active: true
        )
        @res.service_users += 1
      end
    end

    # Carers who appear only in the visit history (leavers) — created DEACTIVATED
    # so their visits have an owner without cluttering the live roster.
    def import_deactivated_carers
      @visits["extra_carers"].each do |c|
        next if Employee.exists?(email: c["email"])

        Employee.create!(
          email: c["email"], password: @password,
          first_name: c["first_name"], last_name: c["last_name"],
          role: :carer, active: false, accepted_invite_at: 1.year.ago
        )
        @res.deactivated += 1
      end
    end

    def import_visits
      emp_by_email = Employee.pluck(:email, :id).to_h
      su_by_name   = ServiceUser.all.index_by { |s| "#{s.first_name} #{s.last_name}" }
      grace = (Setting.instance.late_grace_minutes || 15).minutes
      # Ids already in the DB (cross-run dedup) plus ids we create in THIS run —
      # the export contains a few rows with the same (carer, client, clock-in
      # minute), which map to the same deterministic id; without this the second
      # such row would collide on the unique index and abort the whole import.
      seen = ClockEvent.pluck(:client_event_id).to_set

      @visits["visits"].each do |v|
        emp_id = emp_by_email[v["carer_email"]]
        su = su_by_name[v["su"]]
        next unless emp_id && su

        started = Time.zone.parse(v["clocked_in"])
        # Already imported (or a duplicate within this batch)? Skip.
        in_id = event_id(v["carer_email"], v["su"], started.iso8601, "clock_in")
        if seen.include?(in_id)
          @res.skipped += 1
          next
        end
        seen << in_id

        ended  = v["clocked_out"] ? Time.zone.parse(v["clocked_out"]) : nil
        radius = su.geofence_radius_m || 150
        sched_start = started - (v["late_in_min"] || 0).minutes
        sched_end   = ended && ended > sched_start ? ended : sched_start + 45.minutes
        sched_end   = sched_start + 15.minutes if sched_end < sched_start + 15.minutes

        visit = Visit.create!(service_user: su, scheduled_start: sched_start, scheduled_end: sched_end,
                              status: :published, published_at: sched_start)

        # Terminal lifecycle at create time so the background timer can't race a
        # months-old visit into a false "missed".
        if ended
          lifecycle = :completed
          cols = { actual_start: started, actual_end: ended, worked_minutes: ((ended - started) / 60).round }
        else
          lifecycle = started > sched_start + grace ? :late : :in_progress
          cols = { actual_start: started }
        end
        va = VisitAssignment.create!(visit: visit, employee_id: emp_id,
                                     assignment_status: "assigned", lifecycle_state: lifecycle, **cols)

        write_event(va, "clock_in", started, v["in_lat"], v["in_lng"], v["in_metres"], radius, v["offline_in"], in_id)
        # Clock-out id can also collide (two rows sharing carer+client+out-minute).
        # Only write it if that id hasn't been used — otherwise the visit is still
        # valid, it just carries the clock-in.
        if ended
          out_id = event_id(v["carer_email"], v["su"], ended.iso8601, "clock_out")
          unless seen.include?(out_id)
            seen << out_id
            write_event(va, "clock_out", ended, v["out_lat"] || v["in_lat"], v["out_lng"] || v["in_lng"],
                        v["out_metres"], radius, v["offline_out"], out_id)
          end
        end
        @res.visits += 1
      end
    end

    # One fully-formed clock event in a single INSERT — clock_events has a DB
    # append-only rule that silently swallows UPDATEs, so every column (distance,
    # geofence, origin) must be right at insert. INSERT is allowed by the rule.
    def write_event(va, kind, at, lat, lng, metres, radius, offline, cid)
      geo = metres.nil? ? "not_checked" : (metres <= radius ? "pass" : "fail")
      ClockEvent.create!(
        visit_assignment: va, kind: kind, occurred_at: at, recorded_at: at,
        lat: lat, lng: lng, distance_from_site_m: metres, geofence_result: geo,
        origin: offline ? "offline_sync" : "live", method: "gps", client_event_id: cid
      )
    end
  end
end
