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
    # Which categories are allowed to send a browser push at all. Kept narrow on
    # purpose: the two critical care alerts plus new messages, so push stays
    # high-signal. Everything else is in-app/email only even if a caller requests
    # the push channel. Broaden this once client policy (Jesse) confirms.
    PUSHABLE_CATEGORIES = (CRITICAL_CATEGORIES + %w[message]).freeze

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
          # in_app: push it live over the cable so the bell updates (and rings)
          # immediately, instead of waiting for the next poll. email is sent by
          # its own job. Broadcast is best-effort — a socket problem must never
          # fail an already-created notification.
          broadcast(recipient, notification) if channel == "in_app"
          Notifications::EmailNotificationJob.perform_later(notification.id) if channel == "email"
          Notifications::PushNotificationJob.perform_later(notification.id) if channel == "push"
          notification
        end
      end
    end

    # Push the notification to the recipient's live socket(s). Same address as
    # chat messages so one InboxChannel subscription receives both.
    def self.broadcast(recipient, notification)
      ActionCable.server.broadcast(
        "inbox:#{recipient.class.name}:#{recipient.id}",
        { type: "notification", notification: NotificationSerializer.call(notification) }
      )
    rescue StandardError => e
      Rails.logger.warn("[cable] notification broadcast failed: #{e.message}")
    end

    # Critical alerts ignore the in-app off-switch (§7).
    def self.enabled?(recipient, category, channel)
      return true if channel == "in_app" && CRITICAL_CATEGORIES.include?(category)
      # Push is opt-in by category: only the critical alerts and messages may push,
      # regardless of what a caller requests or a preference allows.
      return false if channel == "push" && PUSHABLE_CATEGORIES.exclude?(category)

      pref = recipient.notification_preferences.find_by(notification_type: category)
      pref ? pref.public_send(channel) : CHANNEL_DEFAULTS[channel]
    end
  end
end
