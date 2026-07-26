module Mfa
  # Short-lived, signed pre-auth token issued after a correct password when MFA
  # is active. It is NOT an access token — it only lets the holder submit a code
  # to the mfa endpoint. Stateless (Rails message verifier, secret_key_base).
  class ChallengeToken
    PURPOSE = "mfa_challenge".freeze
    EXPIRY  = 5.minutes

    SCOPES = { admin: "Admin", employee: "Employee" }.freeze

    def self.issue(resource, scope)
      verifier.generate(
        { "sub" => resource.id, "scope" => scope.to_s },
        purpose: PURPOSE, expires_in: EXPIRY
      )
    end

    # Returns [resource, scope_symbol] or nil if invalid/expired.
    def self.resolve(token)
      return nil if token.blank?

      data  = verifier.verify(token, purpose: PURPOSE)
      scope = data["scope"].to_sym
      klass = SCOPES[scope]&.constantize
      resource = klass&.find_by(id: data["sub"])
      resource && [ resource, scope ]
    rescue ActiveSupport::MessageVerifier::InvalidSignature
      nil
    end

    def self.verifier = Rails.application.message_verifier("mfa")
  end
end
