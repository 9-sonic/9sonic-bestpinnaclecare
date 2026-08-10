module Api
  module V1
    module Staff
      # Passwordless (biometric) login for carers. Ends by minting the same JWT.
      class WebauthnSessionsController < ApplicationController
        include TokenAuthentication

        # POST /api/v1/staff/webauthn/authentication/options { email }
        def create_options
          employee = Employee.find_for_authentication(email: params[:email].to_s.downcase)

          # Always answer with the same shape and status. For an unknown email
          # (or an account without a passkey) we return a decoy challenge, so the
          # response can't reveal which staff addresses are registered. A later
          # authentication attempt against a decoy simply fails.
          options =
            if employee&.webauthn_credentials&.exists?
              Webauthn::AuthenticationOptions.call(employee)
            else
              Webauthn::AuthenticationOptions.decoy
            end

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
