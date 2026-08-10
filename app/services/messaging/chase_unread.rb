module Messaging
  # Re-notifies the participants who have not yet read the conversation's latest
  # message. Used by the "Chase unread" action on a broadcast/notice.
  class ChaseUnread
    Result = Struct.new(:chased, :message, keyword_init: true)

    def self.call(conversation:, actor:)
      message = conversation.messages.visible.order(created_at: :desc).first
      return Result.new(chased: 0, message: nil) unless message

      unread = conversation.conversation_participants.active
                           .reject { |cp| cp.participant == actor }
                           .select { |cp| cp.last_read_message_id.nil? || cp.last_read_message_id < message.id }
                           .map(&:participant)

      Notifications::Deliver.call(
        recipients: unread, category: "message", kind: "message",
        title: "Reminder: unread message", body: message.body&.truncate(80),
        subject: conversation, channels: %w[in_app push email]
      )
      Result.new(chased: unread.size, message: message)
    end
  end
end
