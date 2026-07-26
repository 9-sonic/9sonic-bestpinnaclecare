module AuthHelpers
  # Mint a devise-jwt access token directly (used to document authenticated endpoints).
  def jwt_for(resource, scope)
    Warden::JWTAuth::UserEncoder.new.call(resource, scope, nil).first
  end
end

RSpec.configure do |config|
  config.include AuthHelpers, type: :request
end
