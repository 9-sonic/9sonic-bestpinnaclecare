class RefreshToken < ApplicationRecord
  belongs_to :owner, polymorphic: true   # Admin | Employee
  belongs_to :device, optional: true

  scope :active, -> { where(revoked_at: nil).where("expires_at > ?", Time.current) }
end
