class AddBreakKindsToClockKind < ActiveRecord::Migration[8.1]
  disable_ddl_transaction! # ALTER TYPE ... ADD VALUE cannot run in a transaction

  def up
    execute "ALTER TYPE clock_kind ADD VALUE IF NOT EXISTS 'break_start'"
    execute "ALTER TYPE clock_kind ADD VALUE IF NOT EXISTS 'break_end'"
  end

  def down
    # Postgres cannot drop enum values; irreversible.
  end
end
