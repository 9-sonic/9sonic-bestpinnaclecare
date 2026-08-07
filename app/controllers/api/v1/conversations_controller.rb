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
        mine = ConversationParticipant.where(
          participant_type: current_identity.class.name, participant_id: current_identity.id, left_at: nil
        ).select(:conversation_id)
        Conversation.where(id: mine)
      end

      def resolve_person(p)
        klass = p[:type].to_s == "Admin" ? ::Admin : Employee
        klass.find(p[:id])
      end

      def resolve_people(list) = Array(list).map { |p| resolve_person(p) }
    end
  end
end
