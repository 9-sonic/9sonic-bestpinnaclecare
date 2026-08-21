module Api
  module V1
    class ConversationsController < SharedController
      # GET /api/v1/conversations
      def index
        convos = participating_scope.includes(:conversation_participants).order(last_message_at: :desc)
        render json: convos.map { |c| ConversationSerializer.call(c, viewer: current_identity) }
      end

      # POST /api/v1/conversations
      #   direct: { kind: "direct", participant: { type, id } }
      #   group:  { kind: "group", title, participants: [{ type, id }, ...] }
      def create
        convo =
          case params[:kind]
          when "channel"
            Messaging::CreateConversation.channel(creator: current_identity, title: params.require(:title),
                                                  participants: resolve_people(params[:participants]),
                                                  purpose: params[:purpose],
                                                  auto_post: ActiveModel::Type::Boolean.new.cast(params[:auto_post]))
          when "group"
            Messaging::CreateConversation.group(creator: current_identity, title: params.require(:title),
                                                participants: resolve_people(params[:participants]), purpose: params[:purpose])
          else
            Messaging::CreateConversation.direct(creator: current_identity, other: resolve_person(params.require(:participant)))
          end
        render json: ConversationSerializer.call(convo, viewer: current_identity), status: :created
      end

      # GET /api/v1/conversations/search?q=&limit=
      # Full-text-ish search over message bodies, restricted to the caller's own
      # conversations (a non-participant never sees a match). Returns the matching
      # messages, newest first, each carrying enough conversation context for the
      # UI to show a result row and jump to the thread. Blank q -> empty result.
      def search
        q = params[:q].to_s.strip
        return render(json: { query: q, results: [] }) if q.blank?

        limit = params.fetch(:limit, 30).to_i.clamp(1, 100)
        like  = "%#{ActiveRecord::Base.sanitize_sql_like(q)}%"

        messages = Message.visible
                          .where(conversation_id: my_conversation_ids)
                          .where("messages.body ILIKE ?", like)
                          .includes(conversation: :conversation_participants)
                          .order(created_at: :desc)
                          .limit(limit)

        render json: {
          query: q,
          results: messages.map { |m|
            {
              conversation_id: m.conversation_id,
              conversation_title: ConversationSerializer.call(m.conversation, viewer: current_identity)[:title],
              message_id: m.id,
              snippet: m.body,
              system: m.system,
              created_at: m.created_at&.iso8601
            }
          }
        }
      end

      # PATCH /api/v1/conversations/:id/mute  { muted: true|false }
      def mute
        cp = my_participant(params[:id])
        cp.update!(muted: ActiveModel::Type::Boolean.new.cast(params.fetch(:muted, true)))
        render json: ConversationSerializer.call(cp.conversation, viewer: current_identity)
      end

      # POST /api/v1/conversations/:id/chase — re-notify who hasn't read the latest.
      def chase
        convo = my_participant(params[:id]).conversation
        result = Messaging::ChaseUnread.call(conversation: convo, actor: current_identity)
        render json: { chased: result.chased }
      end

      # POST /api/v1/conversations/:id/participants { participants: [{ type, id }, ...] }
      # Add people to a group/channel the caller is already in. 404 if the caller
      # isn't a member; 422 for a direct thread (can't add a third person to a DM).
      def add_participants
        convo  = my_participant(params[:id]).conversation
        result = Messaging::AddParticipants.call(
          conversation: convo, actor: current_identity,
          people: resolve_people(params[:participants])
        )
        return render json: { error: result.error }, status: :unprocessable_entity unless result.ok

        render json: ConversationSerializer.call(convo.reload, viewer: current_identity)
      end

      # PATCH /api/v1/conversations/:id { title?, purpose? }
      # Rename a channel/group or edit its purpose. A direct thread has no name to
      # set (it's the other person), so 422. Only a member may edit. A rename is
      # announced in the thread so the change is visible and audited.
      def update
        convo = my_participant(params[:id]).conversation
        return render(json: { error: "cannot_rename_direct" }, status: :unprocessable_entity) if convo.direct?

        old_title = convo.title
        attrs = {}
        attrs[:title]   = params[:title].to_s.strip   if params.key?(:title)
        attrs[:purpose] = params[:purpose].to_s.strip if params.key?(:purpose)
        return render(json: { error: "title_required" }, status: :unprocessable_entity) if attrs[:title] == ""

        convo.update!(attrs)
        if attrs[:title].present? && attrs[:title] != old_title
          Messaging::PostSystemMessage.call(
            conversation: convo, body: "#{current_identity.full_name} renamed this to “#{attrs[:title]}”."
          )
        end
        render json: ConversationSerializer.call(convo.reload, viewer: current_identity)
      end

      # DELETE /api/v1/conversations/:id
      # Delete a channel/group: soft-archive (stamp archived_at) so its history is
      # kept, and drop it from everyone's list. A direct thread can't be deleted
      # this way — you leave a DM, you don't erase it for the other person.
      def destroy
        convo = my_participant(params[:id]).conversation
        return render(json: { error: "cannot_delete_direct" }, status: :unprocessable_entity) if convo.direct?

        convo.update!(archived_at: Time.current) if convo.archived_at.nil?
        head :no_content
      end

      # DELETE /api/v1/conversations/:id/participants/:participant_type/:participant_id
      # Remove one person from a group/channel. Soft: stamps their left_at (the
      # row stays, so their past messages and read history are preserved). Removing
      # yourself is "leave"; a direct thread rejects removal (422). Announced in
      # the thread for the audit trail.
      def remove_participant
        convo = my_participant(params[:id]).conversation
        return render(json: { error: "cannot_leave_direct" }, status: :unprocessable_entity) if convo.direct?

        target = convo.conversation_participants.active.find_by(
          participant_type: params[:participant_type], participant_id: params[:participant_id]
        )
        return head(:not_found) unless target

        person = target.participant
        target.update!(left_at: Time.current)
        removed_self = target.participant_type == current_identity.class.name && target.participant_id == current_identity.id
        body = removed_self ? "#{person&.full_name} left." : "#{current_identity.full_name} removed #{person&.full_name}."
        Messaging::PostSystemMessage.call(conversation: convo, body: body)
        render json: ConversationSerializer.call(convo.reload, viewer: current_identity)
      end

      private

      # The caller's active participant row for a conversation, or 404.
      def my_participant(conversation_id)
        ConversationParticipant.active.find_by!(
          conversation_id: conversation_id, participant_type: current_identity.class.name,
          participant_id: current_identity.id
        )
      end

      # Subquery (not joins+where) so the eager-loaded participant list isn't
      # filtered down to just the viewer's own row.
      def participating_scope
        Conversation.where(id: my_conversation_ids, archived_at: nil)
      end

      # The ids of conversations the caller is an active participant of, excluding
      # archived (deleted) ones — the security boundary for anything that reads
      # across conversations (search), so a deleted thread never surfaces.
      def my_conversation_ids
        ConversationParticipant.where(
          participant_type: current_identity.class.name, participant_id: current_identity.id, left_at: nil
        ).where(conversation_id: Conversation.where(archived_at: nil)).select(:conversation_id)
      end

      def resolve_person(p)
        klass = p[:type].to_s == "Admin" ? ::Admin : Employee
        klass.find(p[:id])
      end

      def resolve_people(list) = Array(list).map { |p| resolve_person(p) }
    end
  end
end
