module Messaging
  # Sends a message. Idempotent on client_message_id; touches the conversation,
  # writes delivery receipts for the other participants, and fans out an in-app
  # notification (chat produces a notification, never an alert — §7).
  class SendMessage
    def self.call(conversation:, sender:, body:, client_message_id:, broadcast: false, visit_id: nil, files: nil)
      existing = Message.find_by(client_message_id: client_message_id)
      return existing if existing

      message = nil
      Conversation.transaction do
        message = conversation.messages.create!(sender: sender, body: body, client_message_id: client_message_id,
                                                broadcast: broadcast || false, visit_id: visit_id)
        message.files.attach(files) if files.present?
        others = conversation.conversation_participants.active
                             .where.not(participant_type: sender.class.name, participant_id: sender.id)
                             .map(&:participant)
        others.each { |person| MessageReceipt.create!(message: message, recipient: person, delivered_at: Time.current) }
        notify(message, others)
      end
      fan_out(message)
      message
    rescue ActiveRecord::RecordNotUnique
      Message.find_by(client_message_id: client_message_id)
    end

    # Push the new message over ActionCable to every participant's inbox stream
    # (including the sender, for multi-device). Best-effort: a socket problem must
    # never fail an already-committed send.
    def self.fan_out(message)
      payload = { type: "message", conversation_id: message.conversation_id, message: MessageSerializer.call(message) }
      message.conversation.conversation_participants.active.find_each do |cp|
        ActionCable.server.broadcast("inbox:#{cp.participant_type}:#{cp.participant_id}", payload)
      end
    rescue StandardError => e
      Rails.logger.warn("[cable] message broadcast failed: #{e.message}")
    end

    def self.notify(message, recipients)
      return if recipients.empty?

      Notifications::Deliver.call(
        recipients: recipients, category: "message", kind: "message",
        title: "New message", body: message.body&.truncate(80),
        subject: message.conversation, channels: %w[in_app]
      )
    end
  end
end
