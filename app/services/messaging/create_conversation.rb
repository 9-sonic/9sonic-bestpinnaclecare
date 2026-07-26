module Messaging
  # Creates conversations. 1-to-1 threads dedupe on direct_key so an Admin and an
  # Employee always share exactly one direct thread regardless of who opens it.
  class CreateConversation
    def self.direct(creator:, other:)
      key = Conversation.direct_key_for(creator, other)
      existing = Conversation.find_by(direct_key: key)
      return existing if existing

      Conversation.transaction do
        convo = Conversation.create!(kind: :direct, direct_key: key, created_by: creator)
        add_participant(convo, creator)
        add_participant(convo, other)
        convo
      end
    rescue ActiveRecord::RecordNotUnique
      Conversation.find_by(direct_key: key)
    end

    def self.group(creator:, title:, participants:)
      Conversation.transaction do
        convo = Conversation.create!(kind: :group, title: title, created_by: creator)
        add_participant(convo, creator, role: "owner")
        participants.each { |person| add_participant(convo, person) }
        convo
      end
    end

    def self.add_participant(convo, person, role: "member")
      convo.conversation_participants.find_or_create_by!(participant: person) { |cp| cp.role = role }
    end
  end
end
