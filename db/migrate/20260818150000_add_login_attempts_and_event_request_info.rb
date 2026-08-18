class AddLoginAttemptsAndEventRequestInfo < ActiveRecord::Migration[8.1]
  # Two additions for the audit trail:
  #
  # 1. login_attempts — a dedicated append-only log of every sign-in try
  #    (password, MFA-verified, WebAuthn), success or failure. Not modelled as
  #    an Event because Event.aggregate is NOT NULL: a failed login against an
  #    email that matches no account has nothing to attach to. `resource` is
  #    polymorphic and nullable for exactly that case; `attempted_email` is
  #    always stored so a failed attempt is still traceable.
  #
  # 2. events.ip_address / events.device_fingerprint — so an admin ACTION
  #    (not just a login) can also carry where it came from. Nullable: only
  #    request-originated events (future writes) populate these; existing rows
  #    predate this and stay honestly blank rather than backfilled with a guess.
  def change
    create_table :login_attempts do |t|
      t.text :attempted_email, null: false
      t.boolean :success, null: false
      t.text :failure_reason
      t.bigint :resource_id
      t.text :resource_type
      t.text :scope, null: false # "admin" or "employee"
      t.text :ip_address
      t.text :user_agent
      t.text :device_fingerprint
      t.timestamptz :occurred_at, null: false
      t.timestamptz :created_at, null: false, default: -> { "now()" }
    end
    add_index :login_attempts, [ :resource_type, :resource_id ]
    add_index :login_attempts, :attempted_email
    add_index :login_attempts, :occurred_at, order: :desc

    add_column :events, :ip_address, :text
    add_column :events, :device_fingerprint, :text
  end
end
