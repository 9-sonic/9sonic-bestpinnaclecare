class CreateAlerts < ActiveRecord::Migration[8.1]
  def change
    create_enum :alert_state, %w[open acknowledged resolved]

    create_table :alerts do |t|
      t.text    :alert_type,   null: false
      t.text    :subject_type, null: false
      t.bigint  :subject_id,   null: false
      t.text    :severity, null: false, default: "normal"
      t.column  :raised_at, :timestamptz, null: false, default: -> { "now()" }
      t.enum    :state, enum_type: "alert_state", null: false, default: "open"
      t.references :acknowledged_by_admin, foreign_key: { to_table: :admins }, index: false
      t.column  :acknowledged_at, :timestamptz
      t.column  :resolved_at,     :timestamptz
      t.text    :resolution_note
    end

    add_index :alerts, [ :subject_type, :subject_id, :alert_type ],
      unique: true, where: "state = 'open'", name: "idx_alerts_dedupe"
    add_index :alerts, [ :state, :raised_at ], order: { raised_at: :desc }, name: "idx_alerts_open"
  end
end
