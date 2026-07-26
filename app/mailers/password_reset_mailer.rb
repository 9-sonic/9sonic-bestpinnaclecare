class PasswordResetMailer < ApplicationMailer
  # Link points at the SPA (which then calls PUT .../auth/password with the token).
  def reset_email(resource, token, scope)
    @name       = resource.full_name
    @expiry_hrs = (resource.class.reset_password_within / 3600.0).round
    base        = ENV.fetch("FRONTEND_URL", "http://localhost:5173")
    @reset_url  = "#{base}/reset-password?scope=#{scope}&token=#{token}"

    mail(to: resource.email, subject: "Reset your Best Pinnacle Care password")
  end
end
