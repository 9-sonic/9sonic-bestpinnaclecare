class MessageSerializer
  def self.call(m)
    {
      id:                m.id,
      conversation_id:   m.conversation_id,
      sender_type:       m.sender_type,
      sender_id:         m.sender_id,
      body:              m.body,
      client_message_id: m.client_message_id,
      created_at:        m.created_at&.iso8601,
      edited_at:         m.edited_at&.iso8601,
      deleted_at:        m.deleted_at&.iso8601
    }
  end
end
