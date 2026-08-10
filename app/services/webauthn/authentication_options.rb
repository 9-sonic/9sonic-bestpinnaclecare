module Webauthn
  # Request options for a passwordless (biometric) login: challenge + the
  # resource's allowed credential IDs.
  class AuthenticationOptions
    def self.call(resource)
      WebAuthn::Credential.options_for_get(
        allow: resource.webauthn_credentials.pluck(:external_id),
        user_verification: "required"
      )
    end

    # Same-shaped options with a throwaway challenge and no allowed credentials,
    # for requests where no matching account/passkey exists. Returning these
    # (200) instead of a 404 keeps the response indistinguishable from a real
    # one, so the endpoint cannot be used to enumerate which staff emails are
    # registered. A follow-up authentication attempt simply fails, as before.
    def self.decoy
      WebAuthn::Credential.options_for_get(allow: [], user_verification: "required")
    end
  end
end
