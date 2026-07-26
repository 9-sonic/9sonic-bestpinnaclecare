WebAuthn.configure do |config|
  # The exact origin(s) the PWA is served from. rp_id is derived from this host.
  config.allowed_origins = [ ENV.fetch("WEBAUTHN_ORIGIN", "http://localhost:5173") ]
  config.rp_name = "Best Pinnacle Care"
end
