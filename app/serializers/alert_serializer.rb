class AlertSerializer
  def self.call(a)
    payload = {
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
    payload.merge(context_for(a.subject))
  end

  # Resolve carer / client / window from the alert's subject so the inbox can
  # show who and where, not just a polymorphic id.
  def self.context_for(subject)
    case subject
    when VisitAssignment
      { carer: subject.employee&.full_name, client: subject.visit&.service_user&.full_name, window: window(subject.visit) }
    when Visit
      { carer: nil, client: subject.service_user&.full_name, window: window(subject) }
    else
      {}
    end
  rescue StandardError
    {}
  end

  def self.window(visit)
    return nil unless visit&.scheduled_start && visit&.scheduled_end

    "#{visit.scheduled_start.strftime('%H:%M')}–#{visit.scheduled_end.strftime('%H:%M')}"
  end
end
