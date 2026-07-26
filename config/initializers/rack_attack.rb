class Rack::Attack
  ### Throttles ###

  # Per-IP login attempts
  throttle("logins/ip", limit: 10, period: 60.seconds) do |req|
    req.ip if req.post? && req.path.end_with?("/auth/login")
  end

  # Per-email login attempts (defeats IP rotation against one account)
  throttle("logins/email", limit: 5, period: 60.seconds) do |req|
    if req.post? && req.path.end_with?("/auth/login")
      req.params["email"].to_s.downcase.presence
    end
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
