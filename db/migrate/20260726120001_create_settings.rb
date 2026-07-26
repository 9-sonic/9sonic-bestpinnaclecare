class CreateSettings < ActiveRecord::Migration[8.1]
  def up
    enable_extension "pgcrypto" unless extension_enabled?("pgcrypto")
    enable_extension "citext"   unless extension_enabled?("citext")

    create_table :settings, id: false do |t|
      t.integer :id, null: false, default: 1
      t.text    :company_name, null: false
      t.text    :trading_name
      t.text    :cqc_provider_id
      t.text    :cqc_location_id
      t.text    :address_line1
      t.text    :address_line2
      t.text    :city
      t.text    :postcode
      t.text    :phone
      t.text    :email
      t.text    :logo_key
      t.text    :brand_primary_colour
      t.text    :timezone,      null: false, default: "Europe/London"
      t.text    :currency_code, null: false, default: "GBP"
      t.integer :checkin_window_before_start_minutes, null: false, default: 15
      t.integer :late_grace_minutes,            null: false, default: 5
      t.integer :missed_threshold_minutes,      null: false, default: 30
      t.integer :overdue_threshold_minutes,     null: false, default: 60
      t.integer :auto_close_after_minutes,      null: false, default: 240
      t.integer :early_leave_tolerance_minutes, null: false, default: 10
      t.integer :clock_skew_tolerance_minutes,  null: false, default: 10
      t.text    :geofence_mode,     null: false, default: "block"
      t.integer :geofence_radius_m, null: false, default: 150
      t.text    :timesheet_period,           null: false, default: "weekly"
      t.integer :timesheet_week_starts_on,    null: false, default: 1
      t.integer :timesheet_rounding_minutes,  null: false, default: 0
      t.jsonb   :modules_enabled, null: false, default: { shifts: true }
      t.jsonb   :extra,           null: false, default: {}
      t.column  :updated_at, :timestamptz, null: false, default: -> { "now()" }
    end

    execute "ALTER TABLE settings ADD PRIMARY KEY (id);"
    add_check_constraint :settings, "id = 1", name: "settings_single_row"
  end

  def down
    drop_table :settings
  end
end
