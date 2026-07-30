module Api
  module V1
    # POST /api/v1/auth/refresh  — rotate a refresh token for a fresh access token
    # DELETE /api/v1/auth/refresh — revoke a refresh token
    class RefreshController < ApplicationController
      def create
        result = Auth::RefreshTokens.rotate(params.require(:refresh_token))
        return render json: { error: "invalid_refresh_token" }, status: :unauthorized if result == :invalid

        serializer = TokenAuthentication::SERIALIZERS.fetch(result[:scope])
        render json: {
          access:            result[:access],
          access_expires_at: result[:access_expires_at],
          refresh_token:     result[:refresh_token],
          result[:scope] => serializer.call(result[:resource])
        }
      end

      def destroy
        Auth::RefreshTokens.revoke(params.require(:refresh_token))
        head :no_content
      end
    end
  end
end
