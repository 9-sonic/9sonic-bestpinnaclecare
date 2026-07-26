class InvitationMailer < ApplicationMailer
  def invite(resource, token, scope)
    @name       = resource.full_name
    base        = ENV.fetch("FRONTEND_URL", "http://localhost:5173")
    @accept_url = "#{base}/accept-invite?scope=#{scope}&token=#{token}"

    mail(to: resource.email, subject: "You've been invited to Best Pinnacle Care")
  end
end
