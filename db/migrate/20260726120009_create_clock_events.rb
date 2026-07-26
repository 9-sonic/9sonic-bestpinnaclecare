class CreateClockEvents < ActiveRecord::Migration[8.1]
  def up
    create_enum :clock_kind, %w[clock_in clock_out]
    create_enum :geofence_result, %w[pass fail no_fix not_checked]

    create_table :clock_events do |t|
      t.references :shift_assignment, null: false, foreign_key: true, index: false
      t.enum    :kind, enum_type: "clock_kind", null: false
      t.column  :occurred_at, :timestamptz, null: false
      t.column  :recorded_at, :timestamptz, null: false, default: -> { "now()" }
      t.text    :method, null: false, default: "gps"     # gps|manual_admin
      t.decimal :lat, precision: 10, scale: 7
      t.decimal :lng, precision: 10, scale: 7
      t.integer :accuracy_m
      t.enum    :geofence_result, enum_type: "geofence_result", null: false, default: "not_checked"
      t.integer :distance_from_site_m
      t.uuid    :device_fingerprint
      t.uuid    :client_event_id, null: false
      t.text    :reason                                   # required if manual_admin
      t.bigint  :corrects_id
      t.text    :created_by_type                          # 'Admin' | 'Employee'
      t.bigint  :created_by_id
    end

    add_check_constraint :clock_events,
      "method <> 'manual_admin' OR reason IS NOT NULL", name: "clock_events_reason_when_manual"
    add_index :clock_events, :client_event_id, unique: true
    add_index :clock_events, [ :shift_assignment_id, :occurred_at ], name: "idx_clock_events_assignment"
    add_index :clock_events, :corrects_id, name: "idx_clock_events_corrects"
    add_foreign_key :clock_events, :clock_events, column: :corrects_id

    # Append-only.
    execute "CREATE RULE clock_events_no_update AS ON UPDATE TO clock_events DO INSTEAD NOTHING;"
    execute "CREATE RULE clock_events_no_delete AS ON DELETE TO clock_events DO INSTEAD NOTHING;"

    # Latest link in each correction chain (rows not superseded by a correction).
    execute <<~SQL
      CREATE VIEW effective_clock_events AS
      SELECT ce.* FROM clock_events ce
      WHERE NOT EXISTS (SELECT 1 FROM clock_events c2 WHERE c2.corrects_id = ce.id);
    SQL
  end

  def down
    execute "DROP VIEW IF EXISTS effective_clock_events;"
    drop_table :clock_events
    drop_enum :clock_kind
    drop_enum :geofence_result
  end
end
