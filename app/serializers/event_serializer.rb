class EventSerializer
  ACTOR_MODELS = %w[Admin Employee].freeze

  def self.call(e)
    {
      id:             e.id,
      event_type:     e.event_type,
      actor_type:     e.actor_type,
      actor_id:       e.actor_id,
      actor_name:     actor_name(e),
      aggregate_type: e.aggregate_type,
      aggregate_id:   e.aggregate_id,
      payload:        e.payload,
      occurred_at:    e.occurred_at&.iso8601,
      recorded_at:    e.recorded_at&.iso8601
    }
  end

  # Resolve a display name without constantizing an unexpected actor_type.
  def self.actor_name(e)
    return "System" if e.actor_id.nil? || e.actor_type == "System"
    return e.actor&.full_name if ACTOR_MODELS.include?(e.actor_type)

    nil
  end
end
