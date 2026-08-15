module Messaging
  # Adds one or more people to an existing group or channel. Direct threads are
  # rejected — a 1-to-1 conversation is keyed on its exact pair (direct_key) and
  # a third person would break that invariant; start a group instead.
  #
  # Re-uses the left_at model: someone who previously left is re-activated
  # (left_at cleared) rather than duplicated. Idempotent — adding a current
  # member is a no-op. Posts a "X added Y" system message so the change is
  # visible in the thread and audited, and fans it out over the inbox streams.
  class AddParticipants
    Result = Struct.new(:ok, :conversation, :added, :error, keyword_init: true)

    # actor:  who is doing the adding (already an active participant)
    # people: array of Admin/Employee records to add
    def self.call(conversation:, actor:, people:)
      return Result.new(ok: false, error: "cannot_add_to_direct") if conversation.direct?

      people = Array(people).compact.uniq
      return Result.new(ok: false, error: "no_people") if people.empty?

      added = []
      Conversation.transaction do
        people.each do |person|
          cp = conversation.conversation_participants
                           .find_or_initialize_by(participant: person)
          # New row, or a previously-departed member being re-added.
          if cp.new_record? || cp.left_at.present?
            cp.left_at = nil
            cp.role ||= "member"
            cp.save!
            added << person
          end
        end
      end

      announce(conversation, actor, added) if added.any?
      Result.new(ok: true, conversation: conversation, added: added)
    end

    # A single system line naming who added whom, e.g.
    #   "Rebecca Hartley added Aisha Khan and Test Carer."
    def self.announce(conversation, actor, people)
      names = people.map { |p| p.full_name }.compact
      body  = "#{actor.full_name} added #{names.to_sentence}."
      PostSystemMessage.call(conversation: conversation, body: body)
    end
  end
end
