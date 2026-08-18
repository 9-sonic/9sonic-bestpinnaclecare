# Append-only log of every sign-in try — password, MFA-verified, or WebAuthn —
# success or failure. Separate from Event because Event.aggregate is required
# and a failed login against an unknown email has no record to attach to;
# attempted_email keeps a failed attempt traceable regardless.
class LoginAttempt < ApplicationRecord
  include AppendOnly

  belongs_to :resource, polymorphic: true, optional: true # Admin | Employee | nil (unknown email)

  scope :recent_first, -> { order(occurred_at: :desc) }
end
