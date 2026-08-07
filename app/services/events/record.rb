module Events
  # The single writer for the append-only Event audit log.
  #
  # Every significant office action funnels through here so the audit trail is
  # one honest record of who did what, when and why. Events are never updated or
  # deleted (see AppendOnly). A nil actor is stored as the "System" actor rather
  # than a null, because actor_type is NOT NULL.
  class Record
    def self.call(aggregate:, event_type:, actor: nil, payload: {}, occurred_at: Time.current, client_event_id: nil)
      attrs = {
        aggregate:       aggregate,
        event_type:      event_type.to_s,
        payload:         payload,
        occurred_at:     occurred_at,
        client_event_id: client_event_id
      }
      if actor
        attrs[:actor] = actor
      else
        attrs[:actor_type] = "System"
      end
      Event.create!(**attrs)
    end
  end
end
