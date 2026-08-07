class AddChannelsAndBroadcast < ActiveRecord::Migration[8.1]
  disable_ddl_transaction!

  def up
    execute "ALTER TYPE conversation_kind ADD VALUE IF NOT EXISTS 'channel'"
    add_column :messages, :broadcast, :boolean, null: false, default: false unless column_exists?(:messages, :broadcast)
  end

  def down
    remove_column :messages, :broadcast, if_exists: true
    # Postgres cannot drop a single enum value; 'channel' is left in place.
  end
end
