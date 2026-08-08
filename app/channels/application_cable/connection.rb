module ApplicationCable
  # Authenticates the WebSocket the same way the HTTP API does — with the JWT.
  # Browsers can't set headers on a WebSocket, so the token comes in as a query
  # param (?token=...). We decode it with the same warden-jwt secret, honour the
  # denylist (logout/revocation), and identify the socket as "Admin:1" /
  # "Employee:5" so channels can stream to the right inbox.
  class Connection < ActionCable::Connection::Base
    identified_by :identity_gid

    SCOPES = { "admin" => ::Admin, "employee" => ::Employee }.freeze

    def connect
      self.identity_gid = find_verified_identity
    end

    private

    def find_verified_identity
      token = request.params[:token].presence
      return reject_unauthorized_connection unless token

      payload = decode(token)
      return reject_unauthorized_connection if payload.nil?
      return reject_unauthorized_connection if JwtDenylist.exists?(jti: payload["jti"])

      identity = SCOPES[payload["scp"].to_s]&.find_by(id: payload["sub"])
      return reject_unauthorized_connection unless identity&.active?

      "#{identity.class.name}:#{identity.id}"
    end

    def decode(token)
      Warden::JWTAuth::TokenDecoder.new.call(token)
    rescue StandardError
      nil
    end
  end
end
