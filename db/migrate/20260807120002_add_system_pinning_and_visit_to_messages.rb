class AddSystemPinningAndVisitToMessages < ActiveRecord::Migration[8.1]
  def change
    # System messages (e.g. an auto-posted alert) have no human sender.
    add_column :messages, :system, :boolean, default: false, null: false
    change_column_null :messages, :sender_id, true
    change_column_null :messages, :sender_type, true

    # Pin one message to the top of a conversation.
    add_column :messages, :pinned_at, :timestamptz
    add_column :messages, :pinned_by_type, :text
    add_column :messages, :pinned_by_id, :bigint

    # Attach a visit ("shift") to a message.
    add_column :messages, :visit_id, :bigint
    add_index  :messages, :visit_id
    add_index  :messages, [ :conversation_id, :pinned_at ], where: "pinned_at IS NOT NULL", name: "idx_messages_pinned"
  end
end
