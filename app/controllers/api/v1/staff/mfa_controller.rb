module Api
  module V1
    module Staff
      # Enrol/confirm TOTP for the signed-in carer (optional for employees).
      class MfaController < BaseController
        include MfaManagement
      end
    end
  end
end
