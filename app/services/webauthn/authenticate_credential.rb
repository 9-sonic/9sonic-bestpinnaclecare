module Webauthn
  # Verifies the assertion from navigator.credentials.get against the stored
  # public key, bumps the sign counter (clone/replay defence), and returns the
  # owning identity (Admin | Employee) or nil.
  class AuthenticateCredential
    def self.call(challenge, credential_params)
      credential = WebAuthn::Credential.from_get(credential_params)
      stored = WebauthnCredential.find_by(external_id: credential.id)
      return nil unless stored

      credential.verify(challenge, public_key: stored.public_key, sign_count: stored.sign_count)
      stored.update!(sign_count: credential.sign_count, last_used_at: Time.current)
      stored.owner
    rescue WebAuthn::Error
      nil
    end
  end
end
