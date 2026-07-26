class ConversationParticipant < ApplicationRecord
  belongs_to :conversation
  belongs_to :participant, polymorphic: true   # Admin | Employee

  scope :active, -> { where(left_at: nil) }

  def unread_count
    conversation.messages.where("id > ?", last_read_message_id || 0)
                .where.not(sender_type: participant_type, sender_id: participant_id).count
  end
end
