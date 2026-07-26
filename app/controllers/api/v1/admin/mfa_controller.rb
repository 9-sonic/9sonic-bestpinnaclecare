module Api
  module V1
    module Admin
      # Enrol/confirm TOTP for the signed-in admin.
      class MfaController < BaseController
        include MfaManagement
      end
    end
  end
end
