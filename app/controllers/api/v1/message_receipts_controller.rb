module Api
  module V1
    class MessageReceiptsController < SharedController
      # POST /api/v1/messages/:id/receipts — mark read.
      def create
        message = Message.joins(conversation: :conversation_participants).where(
          conversation_participants: { participant_type: current_identity.class.name, participant_id: current_identity.id }
        ).find(params[:id])

        receipt = Messaging::MarkRead.call(message: message, reader: current_identity)
        render json: { message_id: message.id, read_at: receipt.read_at&.iso8601 }, status: :ok
      end
    end
  end
end
