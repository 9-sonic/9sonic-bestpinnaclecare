module Webauthn
  # Verifies the attestation from navigator.credentials.create and stores the
  # new public-key credential against the resource. Raises WebAuthn::Error on
  # a bad attestation (caller renders 422).
  class RegisterCredential
    def self.call(resource, challenge, credential_params, nickname = nil)
      credential = WebAuthn::Credential.from_create(credential_params)
      credential.verify(challenge)

      resource.webauthn_credentials.create!(
        external_id: credential.id,
        public_key:  credential.public_key,
        sign_count:  credential.sign_count,
        nickname:    nickname
      )
    end
  end
end
