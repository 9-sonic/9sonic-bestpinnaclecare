class AddPurposeAndAutoPostToConversations < ActiveRecord::Migration[8.1]
  def change
    # purpose: a one-line "what this conversation is for", shown under the name.
    add_column :conversations, :purpose, :text
    # auto_post: a channel that automatically receives operational alerts
    # (late / missed / geofence) as system messages.
    add_column :conversations, :auto_post, :boolean, default: false, null: false
  end
end
