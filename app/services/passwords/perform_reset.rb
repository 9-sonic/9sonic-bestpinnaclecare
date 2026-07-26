module Passwords
  # Applies a new password given a valid, unexpired token. Returns the resource;
  # check resource.errors for failure (bad/expired token or weak password).
  class PerformReset
    def self.call(resource_class, token, password)
      resource = resource_class.reset_password_by_token(
        reset_password_token:  token.to_s,
        password:              password,
        password_confirmation: password
      )
      # Setting a password via an invite token counts as accepting the invite.
      if resource.errors.empty? && resource.persisted? &&
         resource.invited_at.present? && resource.accepted_invite_at.nil?
        resource.update_columns(accepted_invite_at: Time.current)
      end
      resource
    end
  end
end
