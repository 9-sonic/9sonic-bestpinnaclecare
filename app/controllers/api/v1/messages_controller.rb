module Api
  module V1
    class MessagesController < SharedController
      # GET /api/v1/conversations/:conversation_id/messages?before=<iso8601>
      def index
        # Deleted messages stay in the thread as a tombstone ("message deleted")
        # rather than vanishing — the serializer hides the old body. This keeps
        # the conversation honest about what happened (audit over silent erase).
        scope = conversation.messages.includes(:message_receipts, :reply_to).with_attached_files.order(created_at: :desc)
        scope = scope.where("created_at < ?", Time.zone.parse(params[:before])) if params[:before].present?
        render json: scope.limit(50).map { |m| MessageSerializer.call(m) }
      end

      # POST /api/v1/conversations/:conversation_id/messages { body, client_message_id, broadcast?, visit_id? }
      def create
        message = Messaging::SendMessage.call(
          conversation: conversation, sender: current_identity,
          body: params[:body], client_message_id: params.require(:client_message_id),
          broadcast: ActiveModel::Type::Boolean.new.cast(params[:broadcast]),
          visit_id: params[:visit_id], files: params[:files], reply_to_id: params[:reply_to_id]
        )
        render json: MessageSerializer.call(message), status: :created
      end

      # PATCH /api/v1/conversations/:conversation_id/messages/:id { body }
      # Edit your OWN message. The body changes and `edited_at` is stamped so the
      # UI can mark it "edited" — the record stays honest about having been changed.
      # A system message or someone else's message can't be edited (403).
      def update
        message = conversation.messages.visible.find(params[:id])
        return head(:forbidden) unless own?(message)

        message.update!(body: params.require(:body), edited_at: Time.current)
        Messaging::SendMessage.fan_out(message)
        render json: MessageSerializer.call(message)
      end

      # DELETE /api/v1/conversations/:conversation_id/messages/:id
      # Delete your OWN message. Soft-delete only: we stamp `deleted_at` and keep
      # the row (audit over silent erase — the message existed, and that fact
      # stands). The serializer then returns a tombstone instead of the old body.
      def destroy
        message = conversation.messages.visible.find(params[:id])
        return head(:forbidden) unless own?(message)

        message.update!(deleted_at: Time.current)
        Messaging::SendMessage.fan_out(message)
        render json: MessageSerializer.call(message)
      end

      # POST /api/v1/conversations/:conversation_id/messages/:id/pin
      def pin
        message = conversation.messages.find(params[:id])
        message.update!(pinned_at: Time.current, pinned_by: current_identity)
        render json: MessageSerializer.call(message)
      end

      # DELETE /api/v1/conversations/:conversation_id/messages/:id/pin
      def unpin
        message = conversation.messages.find(params[:id])
        message.update!(pinned_at: nil, pinned_by: nil)
        render json: MessageSerializer.call(message)
      end

      private

      # A message the caller sent themselves. System messages have no sender and
      # belong to nobody, so they can never be edited or deleted this way.
      def own?(message)
        !message.system? &&
          message.sender_type == current_identity.class.name &&
          message.sender_id == current_identity.id
      end

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
