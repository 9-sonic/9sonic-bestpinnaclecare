require "webauthn/fake_client"

RSpec.configure do |config|
  # Specs tagged `:webauthn` use WebAuthn::FakeClient at this origin.
  config.before(:each, :webauthn) do
    WebAuthn.configuration.allowed_origins = [ "http://localhost" ]
  end
end
