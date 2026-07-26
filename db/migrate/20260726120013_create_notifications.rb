class CreateNotifications < ActiveRecord::Migration[8.1]
  def change
    create_table :notifications do |t|
      t.text    :recipient_type, null: false            # 'Admin' | 'Employee'
      t.bigint  :recipient_id,   null: false
      t.text    :notification_type, null: false          # alert|message|system
      t.references :alert, foreign_key: true, index: false
      t.text    :subject_type
      t.bigint  :subject_id
      t.text    :title, null: false
      t.text    :body
      t.text    :channel, null: false                    # in_app|push|email
      t.text    :status, null: false, default: "queued"
      t.column  :sent_at,      :timestamptz
      t.column  :delivered_at, :timestamptz
      t.column  :seen_at,      :timestamptz
      t.text    :failed_reason
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
    end
    add_index :notifications, [ :recipient_type, :recipient_id, :created_at ],
      order: { created_at: :desc }, name: "idx_notifications_recipient"
    add_index :notifications, [ :recipient_type, :recipient_id ],
      where: "seen_at IS NULL AND channel = 'in_app'", name: "idx_notifications_unseen"

    create_table :notification_preferences do |t|
      t.text    :owner_type, null: false                # 'Admin' | 'Employee'
      t.bigint  :owner_id,   null: false
      t.text    :notification_type, null: false
      t.boolean :in_app, null: false, default: true
      t.boolean :push,   null: false, default: true
      t.boolean :email,  null: false, default: false
    end
    add_index :notification_preferences, [ :owner_type, :owner_id, :notification_type ],
      unique: true, name: "idx_notification_prefs_unique"
  end
end
