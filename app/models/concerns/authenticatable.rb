# Shared auth plumbing for Admin and Employee — the two separate identities.
# Devise (database_authenticatable + JWT) handles credentials; devices/tokens/chat
# references are polymorphic so either identity can own them.
module Authenticatable
  extend ActiveSupport::Concern

  included do
    devise :database_authenticatable, :recoverable, :validatable,
           :lockable, :jwt_authenticatable, jwt_revocation_strategy: JwtDenylist

    has_many :devices,                  as: :owner,     dependent: :destroy
    has_many :refresh_tokens,           as: :owner,     dependent: :destroy
    has_many :notifications,            as: :recipient, dependent: :destroy
    has_many :notification_preferences, as: :owner,     dependent: :destroy
    has_many :conversation_participants, as: :participant
    has_many :webauthn_credentials,      as: :owner, dependent: :destroy

    scope :active, -> { where(active: true) }

    # Defined on the class (not the module) so it overrides Devise's lockable
    # version, which is included after this concern. Blocks deactivated accounts.
    def active_for_authentication?
      super && active?
    end
  end

  def full_name = "#{first_name} #{last_name}"

  # MFA (TOTP). A secret is only enforced once its first code has been confirmed.
  def mfa_active?         = mfa_enabled? && mfa_confirmed_at.present?
  def mfa_setup_required? = mfa_enabled? && mfa_confirmed_at.nil?

  # Stable WebAuthn user handle (generated once, on first passkey enrolment).
  def webauthn_handle
    update_column(:webauthn_id, WebAuthn.generate_user_id) if webauthn_id.blank?
    webauthn_id
  end
end
