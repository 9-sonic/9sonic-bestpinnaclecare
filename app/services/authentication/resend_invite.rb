module Authentication
  # Re-issues a pending invite: generates a FRESH set-password token (which
  # invalidates any previous link) and re-sends the invitation email. Works for
  # both carers (Employee) and office users (Admin) since both accept an invite
  # via the standard reset-password flow.
  #
  # Guarded to pending invites only: a resource that has already accepted its
  # invite has a real password, and re-issuing a token for it would be a
  # password-reset in disguise — that goes through the dedicated reset flow, not
  # here. Raises NotPending so the controller can return a clean 422.
  class ResendInvite
    class NotPending < StandardError; end

    # scope is "staff" for a carer, "admin" for an office user — the same value
    # InviteEmployee/InviteAdmin pass, so the email renders identically.
    def self.call(resource:, scope:)
      unless pending?(resource)
        raise NotPending, "This invite has already been accepted"
      end

      # Refresh invited_at so the pending timestamp reflects the latest send.
      resource.update_columns(invited_at: Time.current)
      token = resource.send(:set_reset_password_token)
      InvitationMailer.invite(resource, token, scope).deliver_later
      resource
    end

    # Pending = was invited and has not yet accepted. Mirrors the status the UI
    # shows ("Invite pending").
    def self.pending?(resource)
      resource.invited_at.present? && resource.accepted_invite_at.nil?
    end
  end
end
