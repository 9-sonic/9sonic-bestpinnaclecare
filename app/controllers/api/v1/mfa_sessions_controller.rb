module Api
  module V1
    # Second step of the two-step login. Exchanges an MFA challenge token + code
    # for a real access token. Scope is carried inside the challenge token.
    class MfaSessionsController < ApplicationController
      include TokenAuthentication

      def create
        resolved = Mfa::ChallengeToken.resolve(params[:mfa_token])
        return render json: { error: "invalid_mfa_token" }, status: :unauthorized unless resolved

        resource, scope = resolved
        if Mfa::Verify.call(resource, params[:otp_code])
          render_access(resource, scope, SERIALIZERS.fetch(scope))
        else
          Auth::RecordLoginAttempt.call(
            scope: scope, request: request, resource: resource,
            success: false, failure_reason: "invalid_mfa_code"
          )
          render json: { error: "invalid_code" }, status: :unauthorized
        end
      end
    end
  end
end
