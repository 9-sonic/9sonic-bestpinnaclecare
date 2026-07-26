class NotificationSerializer
  def self.call(n)
    {
      id:                n.id,
      notification_type: n.notification_type,
      title:             n.title,
      body:              n.body,
      channel:           n.channel,
      status:            n.status,
      alert_id:          n.alert_id,
      subject_type:      n.subject_type,
      subject_id:        n.subject_id,
      seen_at:           n.seen_at&.iso8601,
      created_at:        n.created_at&.iso8601
    }
  end
end
