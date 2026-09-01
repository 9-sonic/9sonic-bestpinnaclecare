module Mfa
  # Generates a fresh TOTP secret for a resource and the data needed to enrol
  # an authenticator app (QR + otpauth URI). Not active until Mfa::Confirm.
  class Enroll
    ISSUER = "Best Pinnacle Care".freeze

    def self.call(resource)
      secret = ROTP::Base32.random
      resource.update!(mfa_secret: secret, mfa_confirmed_at: nil)

      uri = ROTP::TOTP.new(secret, issuer: ISSUER).provisioning_uri(resource.email)
      # `secret` is the base32 key an authenticator app wants for *manual* entry
      # (when the QR can't be scanned) — grouped in fours for legibility client-side.
      { secret: secret, otpauth_uri: uri, qr_svg: qr_svg(uri) }
    end

    def self.qr_svg(uri)
      RQRCode::QRCode.new(uri).as_svg(module_size: 4, use_path: true)
    end
  end
end
