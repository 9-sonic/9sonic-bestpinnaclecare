module Api
  module V1
    class MessagesController < SharedController
      # GET /api/v1/conversations/:conversation_id/messages?before=<iso8601>
      def index
        scope = conversation.messages.visible.order(created_at: :desc)
        scope = scope.where("created_at < ?", Time.zone.parse(params[:before])) if params[:before].present?
        render json: scope.limit(50).map { |m| MessageSerializer.call(m) }
      end

      # POST /api/v1/conversations/:conversation_id/messages { body, client_message_id }
      def create
        message = Messaging::SendMessage.call(
          conversation: conversation, sender: current_identity,
          body: params[:body], client_message_id: params.require(:client_message_id)
        )
        render json: MessageSerializer.call(message), status: :created
      end

      private

      # Only conversations the caller participates in — a non-participant gets 404.
      def conversation
        @conversation ||= Conversation.joins(:conversation_participants).where(
          conversation_participants: {
            participant_type: current_identity.class.name, participant_id: current_identity.id, left_at: nil
          }
        ).find(params[:conversation_id])
      end
    end
  end
end
