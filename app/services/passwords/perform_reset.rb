module Passwords
  # Applies a new password given a valid, unexpired token. Returns the resource;
  # check resource.errors for failure (bad/expired token or weak password).
  class PerformReset
    def self.call(resource_class, token, password)
      resource_class.reset_password_by_token(
        reset_password_token:  token.to_s,
        password:              password,
        password_confirmation: password
      )
    end
  end
end
