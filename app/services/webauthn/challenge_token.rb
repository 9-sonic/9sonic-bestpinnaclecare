module Webauthn
  # Carries the ceremony challenge to the client and back in a signed, short-lived
  # token (stateless — no session/cache needed). Tamper-proof via secret_key_base.
  class ChallengeToken
    EXPIRY = 2.minutes

    def self.issue(challenge, purpose)
      verifier.generate({ "c" => challenge }, purpose: purpose.to_s, expires_in: EXPIRY)
    end

    def self.challenge(token, purpose)
      return nil if token.blank?

      verifier.verify(token, purpose: purpose.to_s)["c"]
    rescue ActiveSupport::MessageVerifier::InvalidSignature
      nil
    end

    def self.verifier = Rails.application.message_verifier("webauthn")
  end
end
