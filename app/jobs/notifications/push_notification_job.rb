module Notifications
  # Sends one queued :push-channel notification to every active browser the
  # recipient has registered, via Web Push (VAPID). Enqueued by
  # Notifications::Deliver for each push notification it writes; runs on Solid
  # Queue. Mirrors EmailNotificationJob.
  #
  # Resilience is the whole point here:
  #  - No VAPID keys configured -> mark failed, don't raise (a missing key must
  #    never break the app or spam the failed-jobs queue).
  #  - A dead/expired subscription (410 Gone / 404) -> clear it off that device so
  #    we stop trying. One bad endpoint never stops the others.
  #  - Sent to at least one device -> the notification is "sent".
  class PushNotificationJob < ApplicationJob
    queue_as :default

    # Push services return these when a subscription is gone for good.
    EXPIRED_STATUSES = [ 404, 410 ].freeze

    def perform(notification_id)
      notification = Notification.find_by(id: notification_id)
      return unless notification&.channel == "push" && notification.status == "queued"

      cfg = Rails.configuration.web_push
      unless cfg.enabled
        notification.update!(status: "failed", failed_reason: "web push not configured")
        return
      end

      devices = notification.recipient&.devices&.active&.where.not(push_subscription: nil).to_a || []
      if devices.empty?
        notification.update!(status: "failed", failed_reason: "no registered push devices")
        return
      end

      delivered = devices.count { |device| deliver_to(device, notification, cfg) }

      if delivered.positive?
        notification.update!(status: "sent", sent_at: Time.current)
      else
        notification.update!(status: "failed", failed_reason: "all push endpoints failed")
      end
    end

    private

    # Send to one device. Returns true on success. Expired subscriptions are
    # cleared; any other error is swallowed (logged) so the remaining devices
    # still get their push.
    def deliver_to(device, notification, cfg)
      sub = device.push_subscription
      WebPush.payload_send(
        endpoint:      sub["endpoint"],
        p256dh:        sub.dig("keys", "p256dh"),
        auth:          sub.dig("keys", "auth"),
        message:       payload(notification),
        vapid:         { subject: cfg.subject, public_key: cfg.public_key, private_key: cfg.private_key },
        ttl:           60 * 60 * 24 # keep for a day if the browser is offline
      )
      true
    rescue WebPush::ExpiredSubscription, WebPush::InvalidSubscription
      device.update_columns(push_subscription: nil, revoked_at: Time.current)
      false
    rescue WebPush::ResponseError => e
      device.update_columns(push_subscription: nil, revoked_at: Time.current) if EXPIRED_STATUSES.include?(e.response&.code.to_i)
      Rails.logger.warn("[push] send failed for device #{device.id}: #{e.message}")
      false
    rescue StandardError => e
      Rails.logger.warn("[push] send error for device #{device.id}: #{e.message}")
      false
    end

    # The JSON the service worker receives in its `push` event. Kept minimal —
    # title/body/a click target — and deliberately free of sensitive detail
    # beyond what's already in the notification title/body (UK GDPR: an OS
    # notification is visible on a lock screen).
    def payload(notification)
      {
        title: notification.title,
        body:  notification.body,
        tag:   "bpc-#{notification.notification_type}-#{notification.subject_id || notification.id}",
        url:   click_url(notification)
      }.to_json
    end

    # Where a click should land. Admin and carer are separate SPAs with separate
    # routers: the office app has no per-conversation route (MessagesPage picks
    # the thread from in-page state, not the URL), so only the carer PWA — which
    # does have /messages/:threadId — gets a click that opens straight into the
    # conversation. Subject is the Conversation, set by
    # Messaging::SendMessage.notify.
    def click_url(notification)
      staff = notification.recipient_type == "Employee"

      case notification.notification_type
      when "message"
        staff && notification.subject_id ? "/messages/#{notification.subject_id}" : "/messages"
      when "alert"
        staff ? "/messages" : "/exceptions"
      else
        staff ? "/home" : "/"
      end
    end
  end
end
