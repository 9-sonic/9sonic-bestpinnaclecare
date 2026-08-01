# A care instruction held against the service user (medication, mobility, etc.).
class CarePlanItem < ApplicationRecord
  belongs_to :service_user

  scope :active, -> { where(active: true) }
  default_scope { order(:position) }
end
