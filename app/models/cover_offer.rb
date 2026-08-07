# An offer of an unfilled visit to a carer. Accepting it creates the assignment.
class CoverOffer < ApplicationRecord
  belongs_to :visit
  belongs_to :employee
  belongs_to :offered_by, class_name: "Admin", foreign_key: :offered_by_admin_id, optional: true

  STATES = %w[pending accepted declined withdrawn].freeze
  validates :state, inclusion: { in: STATES }

  scope :active, -> { where(state: %w[pending accepted]) }
end
