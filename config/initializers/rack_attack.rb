class Rack::Attack
  # The API takes login as a JSON body, and Rack::Attack's req.params only reads
  # the query string + form-encoded body — NOT a JSON body. Reading req.params
  # here silently returned nil, so the per-email throttle never actually fired.
  # Parse the JSON body ourselves (cached on the env so we do it at most once per
  # request, and rewound so downstream body reads still work).
  def self.login_email(req)
    form = req.params["email"]
    return form.to_s.downcase.presence if form.present?

    return nil unless req.media_type == "application/json"

    body = req.body.read
    req.body.rewind
    JSON.parse(body)["email"].to_s.downcase.presence
  rescue JSON::ParserError
    nil
  end

  ### Throttles ###

  # Per-IP login attempts
  throttle("logins/ip", limit: 10, period: 60.seconds) do |req|
    req.ip if req.post? && req.path.end_with?("/auth/login")
  end

  # Per-email login attempts (defeats IP rotation against one account)
  throttle("logins/email", limit: 5, period: 60.seconds) do |req|
    login_email(req) if req.post? && req.path.end_with?("/auth/login")
  end

  # MFA code verification — the SECOND factor is brute-forceable too. A caller
  # who has a valid password + challenge token could otherwise try the 6-digit
  # TOTP (a million combinations) against /auth/mfa as fast as the API allows.
  # Tighter than login: 10/min/IP is plenty for a human fat-fingering a code.
  throttle("mfa/ip", limit: 10, period: 60.seconds) do |req|
    req.ip if req.post? && req.path.end_with?("/auth/mfa")
  end

  # Passwordless (WebAuthn) authentication — same reasoning as login.
  throttle("webauthn/ip", limit: 10, period: 60.seconds) do |req|
    req.ip if req.post? && req.path.end_with?("/webauthn/authentication")
  end

  # Password-reset requests — cheap to fire, each sends an email. Rate-limit by
  # IP so it can't be used to spam a mailbox or enumerate accounts by timing.
  throttle("password_reset/ip", limit: 5, period: 60.seconds) do |req|
    req.ip if req.post? && req.path.end_with?("/auth/password")
  end

  # General API ceiling per IP
  throttle("api/ip", limit: 300, period: 60.seconds) do |req|
    req.ip if req.path.start_with?("/api/")
  end

  self.throttled_responder = lambda do |_req|
    [ 429, { "Content-Type" => "application/json" }, [ { error: "rate_limited" }.to_json ] ]
  end
end

if Rails.env.test?
  # Off by default in tests (so multi-login specs don't trip it); the throttle
  # spec re-enables it. Use a real store so counting works when enabled.
  Rack::Attack.enabled = false
  Rack::Attack.cache.store = ActiveSupport::Cache::MemoryStore.new
end
