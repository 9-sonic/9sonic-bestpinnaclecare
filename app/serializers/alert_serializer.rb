class AlertSerializer
  def self.call(a)
    {
      id:              a.id,
      alert_type:      a.alert_type,
      severity:        a.severity,
      state:           a.state,
      subject_type:    a.subject_type,
      subject_id:      a.subject_id,
      raised_at:       a.raised_at&.iso8601,
      acknowledged_at: a.acknowledged_at&.iso8601,
      resolved_at:     a.resolved_at&.iso8601
    }
  end
end
