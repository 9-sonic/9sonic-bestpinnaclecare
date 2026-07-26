class Device < ApplicationRecord
  belongs_to :owner, polymorphic: true   # Admin | Employee
  has_many   :refresh_tokens

  scope :active, -> { where(revoked_at: nil) }
end
