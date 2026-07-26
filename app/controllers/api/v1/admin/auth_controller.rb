module Api
  module V1
    module Admin
      # POST /api/v1/admin/auth/login — authenticates against the admins table only.
      class AuthController < ApplicationController
        include TokenAuthentication

        def create
          login_with(::Admin, :admin, AdminSerializer)
        end
      end
    end
  end
end
