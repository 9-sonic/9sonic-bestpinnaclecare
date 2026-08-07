module Messaging
  # Posts an authorless system message into a conversation (e.g. an auto-posted
  # operational alert). Writes delivery receipts for every active participant so
  # unread counts still work. Idempotent on client_message_id.
  class PostSystemMessage
    def self.call(conversation:, body:, subject: nil, client_message_id: nil)
      cid = client_message_id || SecureRandom.uuid
      existing = Message.find_by(client_message_id: cid)
      return existing if existing

      Conversation.transaction do
        message = conversation.messages.create!(
          system: true, sender: nil, body: body, client_message_id: cid,
          visit_id: subject.is_a?(VisitAssignment) ? subject.visit_id : (subject.is_a?(Visit) ? subject.id : nil)
        )
        conversation.conversation_participants.active.each do |cp|
          MessageReceipt.create!(message: message, recipient: cp.participant, delivered_at: Time.current)
        end
        message
      end
    rescue ActiveRecord::RecordNotUnique
      Message.find_by(client_message_id: cid)
    end

    # Fan an alert out to every auto_post channel.
    def self.broadcast_alert(alert)
      body = alert_body(alert)
      Conversation.auto_posting_channels.find_each do |channel|
        # Deterministic UUID so a repeat broadcast for the same alert+channel is idempotent.
        cid = Digest::UUID.uuid_v5(Digest::UUID::URL_NAMESPACE, "alert-#{alert.id}-channel-#{channel.id}")
        call(conversation: channel, body: body, subject: alert.subject, client_message_id: cid)
      end
    end

    def self.alert_body(alert)
      who = alert.subject.try(:employee)&.full_name
      where = alert.subject.try(:visit)&.service_user&.full_name || alert.subject.try(:service_user)&.full_name
      label = Alerts::Raise::TITLES.fetch(alert.alert_type, alert.alert_type.humanize)
      [ label, [ who, where ].compact.join(" → ").presence ].compact.join(": ")
    end
  end
end
