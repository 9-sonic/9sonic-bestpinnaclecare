# One carer's slot on one visit (was ShiftAssignment). Carries the timer-driven
# lifecycle FSM, the clock events, and the worked minutes (attendance).
class VisitAssignment < ApplicationRecord
  belongs_to :visit
  belongs_to :employee
  belongs_to :assigned_by, class_name: "Admin", foreign_key: :assigned_by_admin_id, optional: true
  has_many   :clock_events, dependent: :restrict_with_error
  has_many   :alerts, as: :subject
  has_many   :timesheet_lines
  has_many   :visit_tasks, dependent: :destroy
  has_many   :visit_notes, dependent: :restrict_with_error

  enum :lifecycle_state, {
    scheduled: "scheduled", check_in_window: "check_in_window", grace_period: "grace_period",
    late: "late", in_progress: "in_progress", overdue: "overdue", pending_review: "pending_review",
    completed: "completed", missed: "missed", cancelled: "cancelled"
  }

  scope :assigned, -> { where(assignment_status: "assigned") }
  scope :non_terminal, -> { where(lifecycle_state: %i[scheduled check_in_window grace_period late in_progress overdue pending_review]) }

  def effective_clock_in  = clock_events.effective.where(kind: :clock_in).order(:occurred_at).first
  def effective_clock_out = clock_events.effective.where(kind: :clock_out).order(:occurred_at).last

  # Total unpaid break time in seconds, paired from break_start -> break_end
  # events in chronological order. A break_start with no matching end is ignored
  # rather than guessed — we never invent an unpaid duration.
  def break_seconds
    events = clock_events.effective.where(kind: %i[break_start break_end]).order(:occurred_at)
    seconds = 0.0
    open_start = nil
    events.each do |e|
      if e.kind == "break_start"
        open_start ||= e.occurred_at
      elsif e.kind == "break_end" && open_start
        seconds += (e.occurred_at - open_start)
        open_start = nil
      end
    end
    seconds
  end

  # Break time rounded to whole minutes (for display / timesheet lines).
  def break_minutes = (break_seconds / 60.0).round
end
