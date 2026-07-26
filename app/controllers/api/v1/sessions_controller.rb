module Api
  module V1
    class SessionsController < ApplicationController
      # Shared logout. devise-jwt's revocation_requests middleware matches
      # DELETE /api/v1/auth/logout and denylists the bearer token's jti.
      def logout
        head :no_content
      end
    end
  end
end
