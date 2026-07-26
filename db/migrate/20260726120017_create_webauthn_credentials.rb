class CreateWebauthnCredentials < ActiveRecord::Migration[8.1]
  def change
    # Stable per-user WebAuthn handle (never the email — spec-recommended).
    %i[admins employees].each { |t| add_column t, :webauthn_id, :string }

    create_table :webauthn_credentials do |t|
      t.text   :owner_type, null: false      # 'Admin' | 'Employee'
      t.bigint :owner_id,   null: false
      t.string :external_id, null: false      # credential ID (base64url)
      t.text   :public_key,  null: false
      t.bigint :sign_count,  null: false, default: 0
      t.text   :nickname
      t.column :last_used_at, :timestamptz
      t.column :created_at,   :timestamptz, null: false, default: -> { "now()" }
    end

    add_index :webauthn_credentials, :external_id, unique: true
    add_index :webauthn_credentials, [ :owner_type, :owner_id ], name: "idx_webauthn_credentials_owner"
  end
end
