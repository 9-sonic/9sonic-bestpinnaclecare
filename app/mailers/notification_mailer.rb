class NotificationMailer < ApplicationMailer
  # Emails a single heads-up (an alert or a system notification) to its recipient
  # so nothing important is missed. The recipient is an Admin or an Employee; the
  # link points at whichever app they use. Sent from Notifications::EmailNotificationJob
  # for notifications written on the :email channel.
  def notify(notification)
    @notification = notification
    @recipient    = notification.recipient
    @title        = notification.title
    @body         = notification.body
    @url          = frontend_base(scope_for(@recipient))

    mail(to: @recipient.email, subject: @title)
  end

  private

  # Admins use the office web app; everyone else (carers) uses the PWA.
  def scope_for(recipient)
    recipient.is_a?(Admin) ? "admin" : "staff"
  end
end
