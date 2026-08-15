# Append-only. Corrections insert a NEW row with corrects_id -> original + a mandatory reason.
class ClockEvent < ApplicationRecord
  include AppendOnly

  belongs_to :visit_assignment
  belongs_to :created_by, polymorphic: true, optional: true   # Admin (correction) | Employee (own clock)
  belongs_to :corrects, class_name: "ClockEvent", optional: true
  has_one    :corrected_by, class_name: "ClockEvent", foreign_key: :corrects_id

  enum :kind, { clock_in: "clock_in", clock_out: "clock_out", break_start: "break_start", break_end: "break_end" }
  enum :geofence_result, { pass: "pass", fail: "fail", no_fix: "no_fix", not_checked: "not_checked" }, prefix: :geo
  # How the event reached us. Set at insert time; never updated (append-only).
  enum :origin, { live: "live", offline_sync: "offline_sync", manual_admin: "manual_admin" }, prefix: :origin

  scope :effective, -> { where.not(id: ClockEvent.where.not(corrects_id: nil).select(:corrects_id)) }

  validates :reason, presence: true, if: -> { method == "manual_admin" }
end
