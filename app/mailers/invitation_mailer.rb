class InvitationMailer < ApplicationMailer
  def invite(resource, token, scope)
    @name       = resource.full_name
    @accept_url = "#{frontend_base(scope)}/accept-invite?scope=#{scope}&token=#{token}"

    mail(to: resource.email, subject: "You've been invited to Best Pinnacle Care")
  end
end
