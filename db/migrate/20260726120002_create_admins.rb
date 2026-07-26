class CreateAdmins < ActiveRecord::Migration[8.1]
  def change
    create_enum :admin_role, %w[registered_manager manager coordinator finance auditor]

    create_table :admins do |t|
      t.column  :email, :citext, null: false
      t.text    :password_digest, null: false
      t.text    :first_name, null: false
      t.text    :last_name,  null: false
      t.text    :phone
      t.enum    :role, enum_type: "admin_role", null: false
      t.text    :mfa_secret
      t.boolean :mfa_enabled, null: false, default: true  # required for admins
      t.integer :failed_attempts, null: false, default: 0
      t.column  :locked_at,          :timestamptz
      t.column  :invited_at,         :timestamptz
      t.column  :accepted_invite_at, :timestamptz
      t.column  :last_sign_in_at,    :timestamptz
      t.boolean :active, null: false, default: true
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
      t.column  :updated_at, :timestamptz, null: false, default: -> { "now()" }
    end

    add_index :admins, :email, unique: true
    add_index :admins, :active, where: "active", name: "idx_admins_active"
  end
end
