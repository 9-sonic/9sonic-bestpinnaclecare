# Enrol / confirm TOTP for the authenticated identity (current_identity is
# provided by the admin/staff base controllers). Shared by both audiences.
module MfaManagement
  extend ActiveSupport::Concern

  # POST .../mfa — begin enrolment: returns the otpauth URI + QR (SVG).
  def create
    render json: Mfa::Enroll.call(current_identity), status: :ok
  end

  # POST .../mfa/confirm { otp_code } — activate MFA, return one-time backup codes.
  def confirm
    codes = Mfa::Confirm.call(current_identity, params[:otp_code])
    if codes
      render json: { mfa_enabled: true, backup_codes: codes }, status: :ok
    else
      render json: { error: "invalid_code" }, status: :unprocessable_entity
    end
  end
end
