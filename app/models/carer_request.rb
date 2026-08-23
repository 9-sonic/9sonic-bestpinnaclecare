# A carer-initiated request. A carer only ever raises a "drop" — declining a
# visit so the office can arrange cover. Managers approve or decline; the
# decision is audited.
class CarerRequest < ApplicationRecord
  belongs_to :employee
  belongs_to :decided_by, class_name: "Admin", foreign_key: :decided_by_admin_id, optional: true

  KINDS  = %w[drop].freeze
  STATES = %w[pending approved declined cancelled].freeze

  validates :kind, inclusion: { in: KINDS }
  validates :state, inclusion: { in: STATES }
  validates :summary, presence: true

  scope :pending, -> { where(state: "pending") }
end
