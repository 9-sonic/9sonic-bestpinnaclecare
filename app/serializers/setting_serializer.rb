class SettingSerializer
  FIELDS = %i[
    id company_name trading_name cqc_provider_id cqc_location_id
    address_line1 address_line2 city postcode phone email logo_key brand_primary_colour
    timezone currency_code
    checkin_window_before_start_minutes late_grace_minutes missed_threshold_minutes
    overdue_threshold_minutes auto_close_after_minutes early_leave_tolerance_minutes
    clock_skew_tolerance_minutes geofence_mode geofence_radius_m
    timesheet_period timesheet_week_starts_on timesheet_rounding_minutes modules_enabled policy
  ].freeze

  def self.call(setting)
    FIELDS.index_with { |f| setting.public_send(f) }
  end
end
