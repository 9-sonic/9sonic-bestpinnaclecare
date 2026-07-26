class CreateDevicesAndRefreshTokens < ActiveRecord::Migration[8.1]
  def change
    create_table :devices do |t|
      t.text   :owner_type, null: false          # 'Admin' | 'Employee'
      t.bigint :owner_id,   null: false
      t.uuid   :fingerprint, null: false
      t.text   :platform
      t.text   :app_version
      t.jsonb  :push_subscription
      t.column :last_seen_at, :timestamptz
      t.column :revoked_at,   :timestamptz
      t.column :created_at,   :timestamptz, null: false, default: -> { "now()" }
    end
    add_index :devices, :fingerprint, unique: true
    add_index :devices, [ :owner_type, :owner_id ], name: "idx_devices_owner"

    create_table :refresh_tokens do |t|
      t.text   :owner_type, null: false
      t.bigint :owner_id,   null: false
      t.references :device, foreign_key: true, index: false
      t.text   :token_digest, null: false
      t.column :expires_at, :timestamptz, null: false
      t.column :revoked_at, :timestamptz
      t.column :created_at, :timestamptz, null: false, default: -> { "now()" }
    end
    add_index :refresh_tokens, [ :owner_type, :owner_id ], name: "idx_refresh_owner"
  end
end
