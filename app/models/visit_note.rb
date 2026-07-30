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
end
