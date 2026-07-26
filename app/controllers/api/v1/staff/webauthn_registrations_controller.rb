module Api
  module V1
    module Staff
      # Enrol a passkey for the signed-in carer (requires a valid Employee JWT).
      class WebauthnRegistrationsController < BaseController
        # POST /api/v1/staff/webauthn/registration/options
        def create_options
          options = Webauthn::RegistrationOptions.call(current_employee)
          render json: {
            challenge_token: Webauthn::ChallengeToken.issue(options.challenge, :reg),
            options: options.as_json
          }
        end

        # POST /api/v1/staff/webauthn/registration
        def create
          challenge = Webauthn::ChallengeToken.challenge(params[:challenge_token], :reg)
          return render json: { error: "challenge_expired" }, status: :unauthorized unless challenge

          credential = Webauthn::RegisterCredential.call(
            current_employee, challenge, params.require(:credential).to_unsafe_h, params[:nickname]
          )
          render json: { id: credential.id, nickname: credential.nickname }, status: :created
        rescue WebAuthn::Error => e
          render json: { error: "verification_failed", detail: e.message }, status: :unprocessable_entity
        end
      end
    end
  end
end
