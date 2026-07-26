module Api
  module V1
    class NotificationPreferencesController < SharedController
      # GET /api/v1/notification_preferences
      def index
        render json: current_identity.notification_preferences.map { |p| serialize(p) }
      end

      # PATCH /api/v1/notification_preferences  { notification_type, in_app, push, email }
      def update
        pref = current_identity.notification_preferences.find_or_initialize_by(notification_type: params.require(:notification_type))
        pref.update!(params.permit(:in_app, :push, :email))
        render json: serialize(pref)
      end

      private

      def serialize(pref)
        { notification_type: pref.notification_type, in_app: pref.in_app, push: pref.push, email: pref.email }
      end
    end
  end
end
