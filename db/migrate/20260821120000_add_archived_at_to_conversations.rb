class AddArchivedAtToConversations < ActiveRecord::Migration[8.1]
  # Soft-delete for a whole conversation. Deleting a channel or group stamps
  # archived_at rather than destroying the row and its message history — the
  # record that the conversation existed (and what was said in it) stands, in
  # keeping with the one-honest-record principle. Archived threads drop out of
  # everyone's list; direct threads are never archived this way.
  def change
    add_column :conversations, :archived_at, :timestamptz
  end
end
