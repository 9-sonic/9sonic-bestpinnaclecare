# The carer's write-up for a visit. Append-only: an edit inserts a new row with
# supersedes_id -> the original (same principle as clock-event corrections).
class VisitNote < ApplicationRecord
  include AppendOnly

  belongs_to :visit_assignment
  belongs_to :author, polymorphic: true                     # Employee | Admin
  belongs_to :supersedes, class_name: "VisitNote", optional: true
  has_one    :superseded_by, class_name: "VisitNote", foreign_key: :supersedes_id

  # Latest note in each chain (rows not superseded by a newer note).
  scope :effective, -> { where.not(id: VisitNote.where.not(supersedes_id: nil).select(:supersedes_id)) }

  # A correction may only supersede a note on the same visit — otherwise a writer
  # could hide another visit's note from the effective chain.
  validate :supersedes_same_visit
  def supersedes_same_visit
    return if supersedes.nil? || supersedes.visit_assignment_id == visit_assignment_id

    errors.add(:supersedes, "must belong to the same visit")
  end
end
