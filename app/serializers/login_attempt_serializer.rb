class LoginAttemptSerializer
  def self.call(la)
    {
      id:                 la.id,
      attempted_email:    la.attempted_email,
      success:            la.success,
      failure_reason:     la.failure_reason,
      resource_type:      la.resource_type,
      resource_id:        la.resource_id,
      resource_name:      la.resource&.full_name,
      scope:              la.scope,
      ip_address:         la.ip_address,
      user_agent:         la.user_agent,
      device_fingerprint: la.device_fingerprint,
      occurred_at:        la.occurred_at&.iso8601
    }
  end
end
