module Notifications
  # Fans a notification out to recipients across channels, honouring each
  # recipient's NotificationPreference. Writes one Notification row per enabled
  # channel (in_app = the live bell; push/email = queued for their sender jobs).
  # Idempotency and the actual push/email transport are follow-ups.
  class Deliver
    # Email is on by default so people don't miss things; a recipient can still
    # opt out per type via their NotificationPreference. Only channels that a
    # caller actually requests are considered (per-DM messages don't request
    # :email, so they never generate a per-message email).
    CHANNEL_DEFAULTS = { "in_app" => true, "push" => true, "email" => true }.freeze
    CRITICAL_CATEGORIES = %w[missed_visit no_clock_out].freeze

    def self.call(recipients:, category:, title:, body: nil, channels: %w[in_app push], alert: nil, subject: nil, kind: nil)
      Array(recipients).flat_map do |recipient|
        channels.filter_map do |channel|
          next unless enabled?(recipient, category, channel)

          notification = Notification.create!(
            recipient:         recipient,
            notification_type: kind || (alert ? "alert" : "system"),
            alert:             alert,
            subject:           subject || alert&.subject,
            title:             title,
            body:              body,
            channel:           channel,
            status:            "queued"
          )
          # in_app is read live off the row; email is actually sent (and the row
          # marked sent/failed) by its own background job.
          Notifications::EmailNotificationJob.perform_later(notification.id) if channel == "email"
          notification
        end
      end
    end

    # Critical alerts ignore the in-app off-switch (§7).
    def self.enabled?(recipient, category, channel)
      return true if channel == "in_app" && CRITICAL_CATEGORIES.include?(category)

      pref = recipient.notification_preferences.find_by(notification_type: category)
      pref ? pref.public_send(channel) : CHANNEL_DEFAULTS[channel]
    end
  end
end
