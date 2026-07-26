module Api
  module V1
    module Admin
      class SettingsController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager) }, only: :update

        # GET /api/v1/admin/settings
        def show
          render json: SettingSerializer.call(Setting.instance)
        end

        # PATCH /api/v1/admin/settings
        def update
          setting = Setting.instance
          setting.update!(setting_params)
          render json: SettingSerializer.call(setting)
        end

        private

        def setting_params
          params.permit(
            :company_name, :trading_name, :cqc_provider_id, :cqc_location_id,
            :address_line1, :address_line2, :city, :postcode, :phone, :email,
            :logo_key, :brand_primary_colour, :timezone, :currency_code,
            :checkin_window_before_start_minutes, :late_grace_minutes, :missed_threshold_minutes,
            :overdue_threshold_minutes, :auto_close_after_minutes, :early_leave_tolerance_minutes,
            :clock_skew_tolerance_minutes, :geofence_mode, :geofence_radius_m,
            :timesheet_period, :timesheet_week_starts_on, :timesheet_rounding_minutes,
            modules_enabled: {}
          )
        end
      end
    end
  end
end
