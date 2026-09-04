# One dated call to one service user's home (was Shift). Geofence = the service
# user's home; clock-in/out happen here per visit.
class Visit < ApplicationRecord
  belongs_to :service_user
  belongs_to :care_package_slot, optional: true
  belongs_to :published_by, class_name: "Admin", foreign_key: :published_by_admin_id, optional: true
  has_many   :visit_assignments, dependent: :destroy
  has_many   :employees, through: :visit_assignments

  enum :status, { draft: "draft", published: "published", cancelled: "cancelled" }
  scope :published, -> { where(status: :published) }

  validates :scheduled_end, comparison: { greater_than: :scheduled_start }
  validate :must_be_at_least_15_minutes

  # A human label for when-in-the-day this call falls, derived from its UK
  # start time — not a stored field, so it costs no migration and stays in
  # sync automatically if a visit is retimed. Boundaries and the two special
  # cases (a 24h live-in; a long multi-hour day-support call) match the runs
  # the office already uses on paper.
  LIVE_IN_HOURS = 20     # a visit spanning at least this long reads as a live-in, not a timed call
  DAY_SUPPORT_HOURS = 4  # a long single call (not overnight) reads as day support, not a "call"

  def run
    hours = (scheduled_end - scheduled_start) / 1.hour
    return "Live-in" if hours >= LIVE_IN_HOURS
    return "Day support" if hours >= DAY_SUPPORT_HOURS

    start_uk = scheduled_start.in_time_zone("Europe/London")
    minute_of_day = start_uk.hour * 60 + start_uk.min
    case minute_of_day
    when 0...(9 * 60 + 15) then "Morning call"
    when (9 * 60 + 15)...(15 * 60 + 30) then "Lunch call"
    when (15 * 60 + 30)...(18 * 60) then "Tea call"
    else "Bed call"
    end
  end

  private

  def must_be_at_least_15_minutes
    return unless scheduled_start && scheduled_end

    if scheduled_end < (scheduled_start + 15.minutes)
      errors.add(:scheduled_end, "must be at least 15 minutes after scheduled start")
    end
  end
end
