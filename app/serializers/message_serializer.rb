class MessageSerializer
  def self.call(m)
    receipts = m.message_receipts.to_a
    {
      id:                m.id,
      conversation_id:   m.conversation_id,
      sender_type:       m.system? ? "System" : m.sender_type,
      sender_id:         m.sender_id,
      system:            m.system,
      body:              m.body,
      broadcast:         m.broadcast,
      client_message_id: m.client_message_id,
      recipient_count:   receipts.size,
      read_count:        receipts.count { |r| r.read_at.present? },
      pinned_at:         m.pinned_at&.iso8601,
      visit:             visit_ref(m.visit),
      attachments:       m.files.map { |f| { id: f.id, filename: f.filename.to_s, content_type: f.content_type, byte_size: f.byte_size, url: AttachmentUrl.for(f) } },
      created_at:        m.created_at&.iso8601,
      edited_at:         m.edited_at&.iso8601,
      deleted_at:        m.deleted_at&.iso8601
    }
  end

  # A compact "shift" reference for a message-attached visit.
  def self.visit_ref(visit)
    return nil unless visit

    {
      id:              visit.id,
      client:          visit.service_user&.full_name,
      scheduled_start: visit.scheduled_start&.iso8601,
      scheduled_end:   visit.scheduled_end&.iso8601
    }
  end
end
