module Mfa
  # Verifies the first code against the pending secret, activates MFA, and
  # returns the freshly generated plaintext backup codes (shown once).
  class Confirm
    def self.call(resource, code)
      return nil if resource.mfa_secret.blank? || code.blank?

      totp = ROTP::TOTP.new(resource.mfa_secret, issuer: Enroll::ISSUER)
      return nil unless totp.verify(code.to_s.strip, drift_behind: 15, drift_ahead: 15)

      codes = BackupCodes.generate
      resource.update!(
        mfa_enabled:      true,
        mfa_confirmed_at: Time.current,
        mfa_backup_codes: codes.map { |c| BackupCodes.digest(c) }
      )
      codes
    end
  end
end
