module Auth
  # The single writer for the login-attempt audit log. Called on every login
  # outcome (password, MFA-verified, WebAuthn) so the office can see who
  # signed in, from where, on what device — and every failed try, including
  # ones against an email that matches no account.
  class RecordLoginAttempt
    def self.call(scope:, request:, attempted_email: nil, resource: nil, success:, failure_reason: nil, device_fingerprint: nil)
      LoginAttempt.create!(
        attempted_email:    (attempted_email || resource&.email).to_s.downcase,
        success:            success,
        failure_reason:     failure_reason,
        resource:           resource,
        scope:              scope.to_s,
        ip_address:         request&.remote_ip,
        user_agent:         request&.user_agent,
        device_fingerprint: device_fingerprint,
        occurred_at:        Time.current
      )
    end
  end
end
