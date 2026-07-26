class CreateEvents < ActiveRecord::Migration[8.1]
  def up
    create_table :events do |t|
      t.text   :event_type,     null: false
      t.text   :aggregate_type, null: false
      t.bigint :aggregate_id,   null: false
      t.text   :actor_type,     null: false      # 'Admin' | 'Employee' | 'System'
      t.bigint :actor_id
      t.jsonb  :payload, null: false, default: {}
      t.column :redacted_at, :timestamptz
      t.column :occurred_at, :timestamptz, null: false
      t.column :recorded_at, :timestamptz, null: false, default: -> { "now()" }
      t.uuid   :client_event_id
    end

    add_index :events, :client_event_id, unique: true
    add_index :events, :occurred_at, order: { occurred_at: :desc }, name: "idx_events_time"
    add_index :events, [ :aggregate_type, :aggregate_id ], name: "idx_events_aggregate"
    add_index :events, [ :event_type, :occurred_at ], order: { occurred_at: :desc }, name: "idx_events_type"

    # Append-only: silently discard any UPDATE/DELETE at the database level.
    execute "CREATE RULE events_no_update AS ON UPDATE TO events DO INSTEAD NOTHING;"
    execute "CREATE RULE events_no_delete AS ON DELETE TO events DO INSTEAD NOTHING;"
  end

  def down
    drop_table :events
  end
end
