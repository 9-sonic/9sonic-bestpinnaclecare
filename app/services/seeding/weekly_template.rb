module Seeding
  # Loads the recurring weekly rota template (db/seed_data/weekly_template.json)
  # into CarePackageSlot rows — the pattern the office runs every week. Each entry
  # is one recurring visit: a service user, the weekday(s), start/end (UK time) and
  # carers needed. Visits::EnsureHorizon then expands these into dated, published,
  # unassigned visits for the office to staff.
  #
  # Idempotent: a slot is matched by (service_user, start, end, recurrence), so a
  # re-run updates staff_required in place rather than duplicating. Missing service
  # users are created by name (minimal — the office completes address/geofence).
  class WeeklyTemplate
    Result = Struct.new(:clients_created, :slots_created, :slots_updated, keyword_init: true)

    def self.call(path: nil)
      new(path).call
    end

    def initialize(path)
      @path = path || Rails.root.join("db/seed_data/weekly_template.json")
      @res  = Result.new(clients_created: 0, slots_created: 0, slots_updated: 0)
    end

    def call
      data = JSON.parse(File.read(@path))
      data.fetch("slots").each { |entry| upsert(entry) }
      @res
    end

    private

    def upsert(entry)
      su = service_user_for(entry.fetch("service_user"))
      recurrence = entry.fetch("recurrence").to_s.strip

      slot = CarePackageSlot.find_or_initialize_by(
        service_user: su,
        start_time: entry.fetch("start"),
        end_time: entry.fetch("end"),
        recurrence: recurrence
      )
      new_record = slot.new_record?
      slot.staff_required = entry.fetch("staff_required", 1)
      slot.break_minutes ||= 0
      slot.effective_from ||= Date.current
      slot.active = true
      # name is NOT NULL — a human-readable label for the recurring call.
      slot.name = "#{entry.fetch('start')}–#{entry.fetch('end')} #{full_name(su)}"
      slot.save!

      new_record ? @res.slots_created += 1 : @res.slots_updated += 1
    end

    def full_name(su)
      "#{su.first_name} #{su.last_name}".strip
    end

    # Find a service user by name; create a minimal record if missing (only the
    # template's one-off clients, e.g. Steven Evans, should hit this). Geofence and
    # address are left for the office to complete — we never invent client data.
    def service_user_for(full_name)
      first, last = full_name.split(" ", 2)
      ServiceUser.find_by(first_name: first, last_name: last) ||
        begin
          @res.clients_created += 1
          ServiceUser.create!(first_name: first, last_name: last, active: true)
        end
    end
  end
end
