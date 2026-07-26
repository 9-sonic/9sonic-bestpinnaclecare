module Passwords
  # Generates a reset token for an active account and emails the link. Always
  # succeeds silently — never reveals whether the email exists.
  class RequestReset
    def self.call(resource_class, email, scope)
      resource = resource_class.find_for_database_authentication(email: email.to_s.downcase)
      return unless resource&.active?

      raw_token = resource.send(:set_reset_password_token)
      PasswordResetMailer.reset_email(resource, raw_token, scope).deliver_later
      nil
    end
  end
end
