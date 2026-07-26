# devise-jwt revocation store: a token's jti lands here on logout and is rejected thereafter.
class JwtDenylist < ApplicationRecord
  include Devise::JWT::RevocationStrategies::Denylist
  self.table_name = "jwt_denylist"
end
