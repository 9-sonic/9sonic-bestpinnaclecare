module Api
  module V1
    class NotificationsController < SharedController
      # GET /api/v1/notifications
      def index
        render json: current_identity.notifications.order(created_at: :desc).limit(100)
                                     .map { |n| NotificationSerializer.call(n) }
      end

      # POST /api/v1/notifications/:id/seen
      def seen
        notification = current_identity.notifications.find(params[:id])
        notification.update!(seen_at: Time.current)
        render json: NotificationSerializer.call(notification)
      end
    end
  end
end
