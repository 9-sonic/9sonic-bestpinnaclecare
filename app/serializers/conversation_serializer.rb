class ConversationSerializer
  def self.call(convo, viewer: nil)
    cp = viewer && convo.conversation_participants.detect do |p|
      p.participant_type == viewer.class.name && p.participant_id == viewer.id
    end

    {
      id:                   convo.id,
      kind:                 convo.kind,
      title:                convo.title,
      purpose:              convo.purpose,
      auto_post:            convo.auto_post,
      direct_key:           convo.direct_key,
      last_message_at:      convo.last_message_at&.iso8601,
      last_message_preview: convo.last_message&.body&.truncate(80),
      pinned_message:       convo.pinned_message && MessageSerializer.call(convo.pinned_message),
      participants:         convo.conversation_participants.map { |p|
        { type: p.participant_type, id: p.participant_id, role: p.role,
          full_name: p.participant&.full_name, avatar_url: AttachmentUrl.for(p.participant&.avatar) }
      },
      muted:                cp ? cp.muted : false,
      unread_count:         cp ? cp.unread_count : 0
    }
  end
end
