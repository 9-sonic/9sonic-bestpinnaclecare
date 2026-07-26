module Mfa
  # Login-time second-factor check: accepts a valid TOTP code or an unused
  # backup code (which it consumes).
  class Verify
    def self.call(resource, code)
      return false if code.blank? || resource.mfa_secret.blank?

      totp = ROTP::TOTP.new(resource.mfa_secret, issuer: Enroll::ISSUER)
      return true if totp.verify(code.to_s.strip, drift_behind: 15, drift_ahead: 15)

      BackupCodes.consume(resource, code)
    end
  end
end
