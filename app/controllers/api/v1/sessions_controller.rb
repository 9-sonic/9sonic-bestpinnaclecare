module Api
  module V1
    class SessionsController < ApplicationController
      before_action :require_authenticated_identity!, only: :logout

      # Shared logout. devise-jwt's revocation_requests middleware matches
      # DELETE /api/v1/auth/logout and denylists the bearer token's jti. We still
      # require a valid admin or employee token here, so an anonymous caller gets
      # 401 rather than a silent 204 (a state-changing endpoint must be gated).
      def logout
        head :no_content
      end

      private

      def require_authenticated_identity!
        return if warden.authenticate(scope: :admin) || warden.authenticate(scope: :employee)

        render json: { error: "unauthorized" }, status: :unauthorized
      end
    end
  end
end
