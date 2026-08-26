class MessageSerializer
  def self.call(m)
    receipts = m.message_receipts.to_a
    deleted  = m.deleted_at.present?
    {
      id:                m.id,
      conversation_id:   m.conversation_id,
      sender_type:       m.system? ? "System" : m.sender_type,
      sender_id:         m.sender_id,
      system:            m.system,
      # A deleted message keeps its place in the thread but shows nothing of its
      # old content — no body, attachments, visit, or pin leak past the tombstone.
      body:              deleted ? nil : m.body,
      broadcast:         m.broadcast,
      client_message_id: m.client_message_id,
      recipient_count:   receipts.size,
      read_count:        receipts.count { |r| r.read_at.present? },
      pinned_at:         deleted ? nil : m.pinned_at&.iso8601,
      visit:             deleted ? nil : visit_ref(m.visit),
      attachments:       deleted ? [] : m.files.map { |f| serialize_attachment(f) },
      created_at:        m.created_at&.iso8601,
      edited_at:         m.edited_at&.iso8601,
      deleted_at:        m.deleted_at&.iso8601,
      reply_to:          reply_ref(m.reply_to)
    }
  end

  # A compact reference to the message this one is replying to: who wrote it and
  # a short snippet, enough for the UI to show a "replying to X" quote and link
  # back. A deleted original shows as a tombstone, never its old body.
  def self.reply_ref(original)
    return nil unless original

    {
      id:          original.id,
      sender_type: original.system? ? "System" : original.sender_type,
      sender_id:   original.sender_id,
      snippet:     original.deleted_at.present? ? nil : original.body&.truncate(120),
      deleted:     original.deleted_at.present?
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

  # Serialize one Active Storage attachment. Images get resized variant URLs so
  # the chat bubble loads a ~50 KB thumbnail instead of a 5 MB raw original:
  #   • thumbnail_url — 200px, shown inline in the bubble
  #   • url           — 800px display variant for click-to-expand
  # Non-image files (docs, audio, video) skip variants and serve the original.
  def self.serialize_attachment(f)
    base = {
      id:           f.id,
      filename:     f.filename.to_s,
      content_type: f.content_type,
      byte_size:    f.byte_size
    }

    if f.content_type&.start_with?("image/") && f.variable?
      base[:thumbnail_url] = variant_url(f, Message::IMAGE_VARIANTS[:thumb])
      base[:url]           = variant_url(f, Message::IMAGE_VARIANTS[:display])
    else
      base[:url] = AttachmentUrl.for(f)
    end

    base
  end

  # Build an absolute URL for a variant, using the same host logic as
  # AttachmentUrl so the frontend (on a different origin) can reach it.
  def self.variant_url(file, transformations)
    uri = URI.parse(ENV.fetch("APP_URL", "http://localhost:3002"))
    Rails.application.routes.url_helpers.rails_representation_url(
      file.variant(transformations),
      host: uri.host, port: uri.port, protocol: uri.scheme
    )
  rescue StandardError
    AttachmentUrl.for(file)
  end
end
