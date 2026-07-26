module Api
  module V1
    module Staff
      # Passwordless (biometric) login for carers. Ends by minting the same JWT.
      class WebauthnSessionsController < ApplicationController
        include TokenAuthentication

        # POST /api/v1/staff/webauthn/authentication/options { email }
        def create_options
          employee = Employee.find_for_authentication(email: params[:email].to_s.downcase)
          unless employee&.webauthn_credentials&.exists?
            return render json: { error: "no_passkey" }, status: :not_found
          end

          options = Webauthn::AuthenticationOptions.call(employee)
          render json: {
            challenge_token: Webauthn::ChallengeToken.issue(options.challenge, :auth),
            options: options.as_json
          }
        end

        # POST /api/v1/staff/webauthn/authentication
        def create
          challenge = Webauthn::ChallengeToken.challenge(params[:challenge_token], :auth)
          return render json: { error: "challenge_expired" }, status: :unauthorized unless challenge

          employee = Webauthn::AuthenticateCredential.call(challenge, params.require(:credential).to_unsafe_h)
          if employee.is_a?(Employee) && employee.active_for_authentication?
            render_access(employee, :employee, EmployeeSerializer)
          else
            render json: { error: "authentication_failed" }, status: :unauthorized
          end
        end
      end
    end
  end
end
