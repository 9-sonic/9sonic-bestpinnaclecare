module Visits
  # Expands active care-package slots into dated draft visits across a date range.
  # Idempotent: the unique (care_package_slot_id, scheduled_start) index means a
  # re-run over the same window creates nothing new.
  class GenerateFromCarePackages
    DAYS = %w[sun mon tue wed thu fri sat].freeze
    TZ = ActiveSupport::TimeZone["Europe/London"]

    def self.call(from:, to:, slots: CarePackageSlot.active)
      created = 0
      slots.includes(:service_user).find_each do |slot|
        (from..to).each do |date|
          next unless occurs_on?(slot, date)

          starts = TZ.local(date.year, date.month, date.day, slot.start_time.hour, slot.start_time.min)
          ends   = TZ.local(date.year, date.month, date.day, slot.end_time.hour, slot.end_time.min)
          ends += 1.day if ends <= starts # overnight call

          begin
            Visit.create!(
              service_user: slot.service_user, care_package_slot: slot,
              scheduled_start: starts, scheduled_end: ends,
              staff_required: slot.staff_required, break_minutes: slot.break_minutes, status: :draft
            )
            created += 1
          rescue ActiveRecord::RecordNotUnique
            # already generated for this slot + start
          end
        end
      end
      created
    end

    def self.occurs_on?(slot, date)
      return false if slot.effective_from && date < slot.effective_from
      return false if slot.effective_to && date > slot.effective_to

      rec = slot.recurrence.to_s.downcase.strip
      return true if rec.empty? || rec == "daily"

      rec.split(/[,\s]+/).include?(DAYS[date.wday])
    end
  end
end
