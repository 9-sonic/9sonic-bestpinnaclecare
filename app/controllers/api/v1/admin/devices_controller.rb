module Api
  module V1
    module Admin
      # Register/refresh this office browser (for web push) and revoke it on
      # sign-out. Mirrors the carer PWA's Staff::DevicesController, scoped to the
      # signed-in admin — the two apps are hosted separately, so each origin
      # registers its own device and holds its own push subscription.
      class DevicesController < BaseController
        # POST /api/v1/admin/devices { fingerprint, platform?, app_version?, push_subscription? }
        def create
          device = current_admin.devices.find_or_initialize_by(fingerprint: params.require(:fingerprint))
          device.platform    = params[:platform] if params.key?(:platform)
          device.app_version = params[:app_version] if params.key?(:app_version)
          device.push_subscription = push_subscription_param if params[:push_subscription].present?
          device.last_seen_at = Time.current
          device.revoked_at = nil
          new_record = device.new_record?
          device.save!
          render json: DeviceSerializer.call(device), status: (new_record ? :created : :ok)
        end

        # DELETE /api/v1/admin/devices/:fingerprint
        def destroy
          current_admin.devices.find_by(fingerprint: params[:fingerprint])&.update!(revoked_at: Time.current)
          head :no_content
        end

        private

        # Only the standard Web Push subscription shape is stored.
        def push_subscription_param
          params.require(:push_subscription).permit(:endpoint, :expirationTime, keys: %i[p256dh auth]).to_h
        end
      end
    end
  end
end
