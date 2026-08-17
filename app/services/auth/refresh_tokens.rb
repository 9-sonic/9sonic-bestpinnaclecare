require "digest"

module Auth
  # Device-bound, rotating refresh tokens (using the existing refresh_tokens
  # table). Each refresh issues a new token and revokes the old one; presenting
  # an already-revoked token is treated as theft and nukes the owner's chain.
  #
  # A refresh token is transported as "<id>.<secret>"; only the SHA-256 of the
  # secret is stored.
  class RefreshTokens
    LIFETIME   = 30.days
    ACCESS_TTL = ENV.fetch("JWT_EXPIRATION_HOURS", "24").to_i.hours # matches devise-jwt expiration_time

    def self.issue(resource:, scope:, device: nil)
      secret = SecureRandom.urlsafe_base64(48)
      record = resource.refresh_tokens.create!(token_digest: digest(secret), device: device, expires_at: LIFETIME.from_now)
      access, = Warden::JWTAuth::UserEncoder.new.call(resource, scope, nil)
      {
        access:            access,
        access_expires_at: ACCESS_TTL.from_now.iso8601,
        refresh_token:     "#{record.id}.#{secret}"
      }
    end

    # Returns :invalid, or a hash { access:, access_expires_at:, refresh_token:, resource:, scope: }.
    def self.rotate(token)
      record, secret = lookup(token)
      return :invalid unless record

      if record.revoked_at
        # reuse of an already-rotated token => likely stolen; revoke the chain
        record.owner.refresh_tokens.where(revoked_at: nil).update_all(revoked_at: Time.current)
        return :invalid
      end
      return :invalid if record.expires_at < Time.current

      record.update!(revoked_at: Time.current)
      scope = record.owner_type == "Admin" ? :admin : :employee
      issue(resource: record.owner, scope: scope, device: record.device).merge(resource: record.owner, scope: scope)
    end

    def self.revoke(token)
      record, = lookup(token)
      record&.update!(revoked_at: Time.current)
      true
    end

    def self.lookup(token)
      id, secret = token.to_s.split(".", 2)
      record = RefreshToken.find_by(id: id)
      return [ nil, nil ] unless record && secret && secure_compare(record.token_digest, digest(secret))

      [ record, secret ]
    end

    def self.digest(secret) = Digest::SHA256.hexdigest(secret)
    def self.secure_compare(a, b) = ActiveSupport::SecurityUtils.secure_compare(a.to_s, b.to_s)
  end
end
