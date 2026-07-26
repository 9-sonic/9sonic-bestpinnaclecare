module Messaging
  # Marks a message read by a reader: stamps the receipt and advances the
  # participant's last_read_message_id (which drives unread counts).
  class MarkRead
    def self.call(message:, reader:)
      receipt = MessageReceipt.find_or_initialize_by(message: message, recipient: reader)
      receipt.update!(read_at: Time.current, delivered_at: receipt.delivered_at || Time.current)

      cp = message.conversation.conversation_participants.find_by(participant: reader)
      if cp && (cp.last_read_message_id.nil? || cp.last_read_message_id < message.id)
        cp.update!(last_read_message_id: message.id)
      end
      receipt
    end
  end
end
