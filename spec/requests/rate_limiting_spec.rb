require "rails_helper"

# Rack::Attack throttles are disabled in the test env by default (so multi-login
# specs don't trip them). This spec re-enables it and clears the throttle cache
# around each example so the counters start fresh and can't leak between tests.
RSpec.describe "Rate limiting (Rack::Attack)", type: :request do
  around do |example|
    Rack::Attack.enabled = true
    Rack::Attack.cache.store.clear
    example.run
  ensure
    Rack::Attack.enabled = false
    Rack::Attack.cache.store.clear
  end

  # Fire `n` POSTs at `path` with `params`; return the last response status.
  def hammer(path, params, n)
    status = nil
    n.times do
      post path, params: params, as: :json
      status = response.status
    end
    status
  end

  describe "login" do
    let!(:admin) { create(:admin, email: "boss@bpc.test", password: "secret12") }

    it "429s after 5 attempts on the same email in a minute" do
      # 5 allowed, the 6th is throttled (per-email limit is the tighter one).
      last = hammer("/api/v1/admin/auth/login", { email: "boss@bpc.test", password: "wrong" }, 6)
      expect(last).to eq(429)
      expect(response.parsed_body["error"]).to eq("rate_limited")
    end

    it "lets a correct login through under the limit" do
      post "/api/v1/admin/auth/login", params: { email: "boss@bpc.test", password: "secret12" }, as: :json
      expect(response).to have_http_status(:ok)
    end

    it "throttles by IP even across different emails (per-IP ceiling)" do
      # Different emails each time -> the per-email throttle never bites, but the
      # per-IP one (limit 10) does on the 11th.
      status = nil
      11.times { |i| post "/api/v1/admin/auth/login", params: { email: "u#{i}@bpc.test", password: "x" }, as: :json; status = response.status }
      expect(status).to eq(429)
    end
  end

  describe "MFA verification" do
    it "429s after 10 attempts on /auth/mfa in a minute" do
      last = hammer("/api/v1/auth/mfa", { mfa_token: "nope", otp_code: "000000" }, 11)
      expect(last).to eq(429)
    end
  end

  describe "password reset" do
    it "429s after 5 reset requests in a minute" do
      last = hammer("/api/v1/admin/auth/password", { email: "boss@bpc.test" }, 6)
      expect(last).to eq(429)
    end
  end

  it "does not throttle a normal, under-limit request" do
    post "/api/v1/admin/auth/login", params: { email: "nobody@bpc.test", password: "x" }, as: :json
    expect(response.status).not_to eq(429)
  end
end
