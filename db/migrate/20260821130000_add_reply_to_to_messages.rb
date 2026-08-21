class AddReplyToToMessages < ActiveRecord::Migration[8.1]
  # Threaded replies: a message may reference the earlier message it answers.
  # Self-referential FK on the same table; nullify on delete so removing the
  # original doesn't cascade-delete the replies — the reply stands on its own,
  # it just loses the "in reply to" link (the original becomes a tombstone
  # anyway). Nullable: most messages are not replies.
  def change
    add_reference :messages, :reply_to, null: true, foreign_key: { to_table: :messages, on_delete: :nullify }
  end
end
