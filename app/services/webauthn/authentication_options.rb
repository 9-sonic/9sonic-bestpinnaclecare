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
  end
end
