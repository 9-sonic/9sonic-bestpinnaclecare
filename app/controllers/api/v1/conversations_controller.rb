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
          if params[:kind] == "group"
            Messaging::CreateConversation.group(creator: current_identity, title: params[:title],
                                                participants: resolve_people(params[:participants]))
          else
            Messaging::CreateConversation.direct(creator: current_identity, other: resolve_person(params.require(:participant)))
          end
        render json: ConversationSerializer.call(convo, viewer: current_identity), status: :created
      end

      private

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
