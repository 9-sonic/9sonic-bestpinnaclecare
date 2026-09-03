module Visits
  # Keeps a rolling horizon of the weekly template rota generated ahead of today:
  # expand the care-package slots into dated visits for the next `weeks`, then
  # PUBLISH them unassigned so the office sees a full future rota to staff.
  #
  # Idempotent — safe to run daily (the auto-renew job does). Generation skips
  # visits that already exist (unique care_package_slot_id + scheduled_start), and
  # publishing only touches template-generated drafts that are still unassigned, so
  # it never republishes or disturbs a hand-made or already-staffed visit.
  #
  # Publishing an unassigned visit sends no notifications (ShiftAssigned/ShiftChanged
  # act on assigned carers only), so bulk-publishing here is silent by design.
  class EnsureHorizon
    Result = Struct.new(:generated, :published, keyword_init: true)

    def self.call(weeks: 52)
      from = Date.current
      to   = from + weeks.weeks

      generated = GenerateFromCarePackages.call(from: from, to: to)

      # Publish the template's own draft visits in the window, unassigned. Scope to
      # care_package_slot-backed visits so a coordinator's hand-made draft is left
      # alone; left join to assignments and require none, so a draft someone has
      # already started staffing isn't force-published behind their back.
      published = Visit
        .where(status: :draft)
        .where.not(care_package_slot_id: nil)
        .where(scheduled_start: from.beginning_of_day..to.end_of_day)
        .where.missing(:visit_assignments)
        .update_all(status: "published", published_at: Time.current, updated_at: Time.current)

      Result.new(generated: generated, published: published)
    end
  end
end
