require "digest"

module Mfa
  # One-time recovery codes. Plaintext is shown to the user exactly once
  # (at confirmation); only SHA-256 digests are stored.
  class BackupCodes
    COUNT = 10

    def self.generate = Array.new(COUNT) { SecureRandom.alphanumeric(10).downcase }

    def self.digest(code) = Digest::SHA256.hexdigest(code.to_s.strip.downcase)

    # Returns true and removes the code if it matches an unused backup code.
    def self.consume(resource, code)
      d = digest(code)
      return false unless resource.mfa_backup_codes.include?(d)

      resource.update!(mfa_backup_codes: resource.mfa_backup_codes - [ d ])
      true
    end
  end
end
