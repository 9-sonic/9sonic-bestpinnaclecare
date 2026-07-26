class CreateConversationsAndMessages < ActiveRecord::Migration[8.1]
  def change
    create_enum :conversation_kind, %w[direct group]

    create_table :conversations do |t|
      t.enum    :kind, enum_type: "conversation_kind", null: false
      t.text    :title
      t.text    :direct_key                              # sorted "Type:id" pair, dedupes 1-to-1
      t.text    :created_by_type
      t.bigint  :created_by_id
      t.column  :last_message_at, :timestamptz
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
      t.column  :updated_at, :timestamptz, null: false, default: -> { "now()" }
    end
    add_index :conversations, :direct_key, unique: true
    add_index :conversations, :last_message_at, order: { last_message_at: :desc }, name: "idx_conversations_recent"
    add_check_constraint :conversations, "kind <> 'direct' OR direct_key IS NOT NULL", name: "conversations_direct_key"

    create_table :conversation_participants do |t|
      t.references :conversation, null: false, foreign_key: true, index: false
      t.text    :participant_type, null: false          # 'Admin' | 'Employee'
      t.bigint  :participant_id,   null: false
      t.text    :role, null: false, default: "member"
      t.column  :joined_at, :timestamptz, null: false, default: -> { "now()" }
      t.column  :left_at,   :timestamptz
      t.boolean :muted, null: false, default: false
      t.bigint  :last_read_message_id
    end
    add_index :conversation_participants, [ :conversation_id, :participant_type, :participant_id ],
      unique: true, name: "idx_participants_unique"
    add_index :conversation_participants, [ :participant_type, :participant_id ],
      where: "left_at IS NULL", name: "idx_participants_person"

    create_table :messages do |t|
      t.references :conversation, null: false, foreign_key: true, index: false
      t.text    :sender_type, null: false               # 'Admin' | 'Employee'
      t.bigint  :sender_id,   null: false
      t.text    :body
      t.uuid    :client_message_id, null: false
      t.column  :edited_at,  :timestamptz
      t.column  :deleted_at, :timestamptz
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
    end
    add_index :messages, :client_message_id, unique: true
    add_index :messages, [ :conversation_id, :created_at ], order: { created_at: :desc }, name: "idx_messages_conversation"

    create_table :message_attachments do |t|
      t.references :message, null: false, foreign_key: true, index: false
      t.text    :filename,    null: false
      t.text    :storage_key, null: false
      t.text    :content_type
      t.bigint  :byte_size
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
    end

    create_table :message_receipts do |t|
      t.references :message, null: false, foreign_key: true, index: false
      t.text    :recipient_type, null: false            # 'Admin' | 'Employee'
      t.bigint  :recipient_id,   null: false
      t.column  :delivered_at, :timestamptz
      t.column  :read_at,      :timestamptz
    end
    add_index :message_receipts, [ :message_id, :recipient_type, :recipient_id ],
      unique: true, name: "idx_receipts_unique"
    add_index :message_receipts, [ :recipient_type, :recipient_id ],
      where: "read_at IS NULL", name: "idx_receipts_unread"
  end
end
