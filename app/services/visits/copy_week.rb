module Visits
  # Copies a week of visits to another week (shifting dates by the whole-week
  # delta, DST-aware). Creates drafts; idempotent via the slot/start unique index.
  class CopyWeek
    def self.call(from_week_start:, to_week_start:)
      delta = (to_week_start - from_week_start).to_i.days
      source = Visit.where(scheduled_start: from_week_start.beginning_of_day..(from_week_start + 6).end_of_day)

      created = 0
      source.find_each do |v|
        begin
          Visit.create!(
            service_user_id: v.service_user_id, care_package_slot_id: v.care_package_slot_id,
            scheduled_start: v.scheduled_start + delta, scheduled_end: v.scheduled_end + delta,
            staff_required: v.staff_required, break_minutes: v.break_minutes, status: :draft
          )
          created += 1
        rescue ActiveRecord::RecordNotUnique
          # already copied
        end
      end
      created
    end
  end
end
