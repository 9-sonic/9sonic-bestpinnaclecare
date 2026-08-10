module Notifications
  # Sends one queued :email-channel notification and records the outcome on the
  # row (queued -> sent, or failed + reason). Enqueued by Notifications::Deliver
  # for every email notification it writes; runs on Solid Queue. Re-raises on
  # failure so a broken mailer surfaces in the queue's failed executions too.
  class EmailNotificationJob < ApplicationJob
    queue_as :default

    def perform(notification_id)
      notification = Notification.find_by(id: notification_id)
      return unless notification&.channel == "email" && notification.status == "queued"

      if notification.recipient&.email.blank?
        notification.update!(status: "failed", failed_reason: "no email address")
        return
      end

      NotificationMailer.notify(notification).deliver_now
      notification.update!(status: "sent", sent_at: Time.current)
    rescue StandardError => e
      notification&.update(status: "failed", failed_reason: e.message.to_s.truncate(500))
      raise
    end
  end
end
