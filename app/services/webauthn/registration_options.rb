module Webauthn
  # Creation options for enrolling a new passkey. user_verification: "required"
  # forces the device to check biometric/PIN before creating the credential.
  class RegistrationOptions
    def self.call(resource)
      WebAuthn::Credential.options_for_create(
        user: {
          id:           resource.webauthn_handle,
          name:         resource.email,
          display_name: resource.full_name
        },
        exclude: resource.webauthn_credentials.pluck(:external_id),
        authenticator_selection: { user_verification: "required", resident_key: "preferred" }
      )
    end
  end
end
