module Alerts
  # Raises an operational alert, deduped while an alert of the same type is open
  # for the same subject (enforced by a partial unique index). A newly-raised
  # alert fans out to the office admins; a re-raise (dedupe) does not re-notify.
  class Raise
    TITLES = {
      "missed_visit" => "Missed visit",
      "no_clock_out" => "No clock-out",
      "geo_anomaly"  => "Geofence issue"
    }.freeze

    def self.call(subject:, alert_type:, severity: "normal")
      alert = Alert.create!(subject: subject, alert_type: alert_type, severity: severity, state: :open)
      notify(alert)
      Messaging::PostSystemMessage.broadcast_alert(alert)   # into auto_post channels
      alert
    rescue ActiveRecord::RecordNotUnique
      Alert.where(subject: subject, alert_type: alert_type, state: :open).first
    end

    def self.notify(alert)
      Notifications::Deliver.call(
        recipients: Notifications::ResolveRecipients.for_alert(alert),
        category:   alert.alert_type,
        alert:      alert,
        subject:    alert.subject,
        title:      TITLES.fetch(alert.alert_type, alert.alert_type.humanize),
        channels:   %w[in_app push email]
      )
    end
  end
end
