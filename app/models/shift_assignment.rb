# Timer-driven lifecycle FSM lives on lifecycle_state (advanced by Lifecycle::EvaluateStatesJob).
class ShiftAssignment < ApplicationRecord
  belongs_to :shift
  belongs_to :employee
  belongs_to :assigned_by, class_name: "Admin", foreign_key: :assigned_by_admin_id, optional: true
  has_many   :clock_events, dependent: :restrict_with_error
  has_many   :alerts, as: :subject
  has_many   :timesheet_lines

  enum :lifecycle_state, {
    scheduled: "scheduled", check_in_window: "check_in_window", grace_period: "grace_period",
    late: "late", in_progress: "in_progress", overdue: "overdue", pending_review: "pending_review",
    completed: "completed", missed: "missed", cancelled: "cancelled"
  }

  scope :assigned, -> { where(assignment_status: "assigned") }
  scope :non_terminal, -> { where(lifecycle_state: %i[scheduled check_in_window grace_period late in_progress overdue pending_review]) }

  def effective_clock_in  = clock_events.effective.where(kind: :clock_in).order(:occurred_at).first
  def effective_clock_out = clock_events.effective.where(kind: :clock_out).order(:occurred_at).last
end
