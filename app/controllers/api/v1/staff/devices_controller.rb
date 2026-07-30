module Api
  module V1
    module Staff
      # Register/refresh this device (for web push) and revoke it on sign-out.
      class DevicesController < BaseController
        # POST /api/v1/staff/devices { fingerprint, platform?, app_version?, push_subscription? }
        def create
          device = current_employee.devices.find_or_initialize_by(fingerprint: params.require(:fingerprint))
          device.platform    = params[:platform] if params.key?(:platform)
          device.app_version = params[:app_version] if params.key?(:app_version)
          device.push_subscription = params[:push_subscription].to_unsafe_h if params[:push_subscription].present?
          device.last_seen_at = Time.current
          device.revoked_at = nil
          new_record = device.new_record?
          device.save!
          render json: DeviceSerializer.call(device), status: (new_record ? :created : :ok)
        end

        # DELETE /api/v1/staff/devices/:fingerprint
        def destroy
          current_employee.devices.find_by(fingerprint: params[:fingerprint])&.update!(revoked_at: Time.current)
          head :no_content
        end
      end
    end
  end
end
