module Api
  module V1
    class NotificationsController < SharedController
      # GET /api/v1/notifications?unseen=true&before=<iso8601>&limit=50
      def index
        scope = current_identity.notifications.order(created_at: :desc)
        scope = scope.where(seen_at: nil) if params[:unseen].present?
        if (before = parse_time(params[:before]))
          scope = scope.where("created_at < ?", before)
        end
        scope = scope.limit((params[:limit] || 50).to_i.clamp(1, 200))
        render json: scope.map { |n| NotificationSerializer.call(n) }
      end

      # POST /api/v1/notifications/:id/seen
      def seen
        notification = current_identity.notifications.find(params[:id])
        notification.update!(seen_at: Time.current)
        render json: NotificationSerializer.call(notification)
      end

      # POST /api/v1/notifications/seen_all
      def seen_all
        updated = current_identity.notifications.where(seen_at: nil).update_all(seen_at: Time.current)
        render json: { updated: updated }
      end

      private

      def parse_time(str)
        Time.zone.parse(str) if str.present?
      rescue ArgumentError, TypeError
        nil
      end
    end
  end
end
