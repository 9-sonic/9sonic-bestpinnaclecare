module Cover
  # The cover board: published visits in the window that are not yet fully
  # staffed, each with its outstanding offers and derived state (open / offered /
  # filled). An "open shift" is derived from the visit + assignment data — there
  # is no separate open-shift record, so nothing can drift out of sync.
  class Board
    def self.call(window_days: 14) = new(window_days).call

    def initialize(window_days)
      @from = Time.current.beginning_of_day
      @to   = window_days.days.from_now.end_of_day
    end

    def call
      visits          = unfilled_visits
      offers_by_visit = CoverOffer.where(visit_id: visits.map(&:id)).includes(:employee).group_by(&:visit_id)

      shifts = visits.map do |v|
        offers = offers_by_visit[v.id] || []
        { visit: visit_payload(v), offers: offers.map { |o| CoverOfferSerializer.call(o) }, state: shift_state(offers) }
      end

      { open_shifts: shifts, counts: counts(shifts) }
    end

    private

    def unfilled_visits
      Visit.published
           .where(scheduled_start: @from..@to)
           .includes(:service_user, :visit_assignments)
           .order(:scheduled_start)
           .select { |v| active_assignments(v) < v.staff_required }
    end

    def active_assignments(visit)
      visit.visit_assignments.count { |a| a.assignment_status == "assigned" && a.lifecycle_state != "cancelled" }
    end

    def visit_payload(v)
      su = v.service_user
      {
        id:              v.id,
        client:          su&.full_name,
        address:         [ su&.address_line1, su&.postcode ].compact_blank.join(", "),
        scheduled_start: v.scheduled_start&.iso8601,
        scheduled_end:   v.scheduled_end&.iso8601,
        hours:           ((v.scheduled_end - v.scheduled_start) / 3600.0).round(2),
        staff_required:  v.staff_required,
        notes:           v.notes
      }
    end

    def shift_state(offers)
      return "filled"  if offers.any? { |o| o.state == "accepted" }
      return "offered" if offers.any? { |o| o.state == "pending" }

      "open"
    end

    def counts(shifts)
      {
        open:    shifts.count { |s| s[:state] == "open" },
        offered: shifts.count { |s| s[:state] == "offered" },
        filled:  shifts.count { |s| s[:state] == "filled" }
      }
    end
  end
end
