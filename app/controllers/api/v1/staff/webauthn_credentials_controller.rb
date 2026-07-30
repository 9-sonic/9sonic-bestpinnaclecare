module Api
  module V1
    module Staff
      # List / revoke the carer's passkeys (e.g. remove a lost phone).
      class WebauthnCredentialsController < BaseController
        def index
          render json: current_employee.webauthn_credentials.order(:created_at).map { |c|
            { id: c.id, nickname: c.nickname, last_used_at: c.last_used_at&.iso8601, created_at: c.created_at&.iso8601 }
          }
        end

        def destroy
          current_employee.webauthn_credentials.find(params[:id]).destroy!
          head :no_content
        end
      end
    end
  end
end
