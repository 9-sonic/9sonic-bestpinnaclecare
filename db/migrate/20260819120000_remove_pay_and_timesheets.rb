class RemovePayAndTimesheets < ActiveRecord::Migration[8.1]
  # Removes the entire pay + timesheet subsystem: pay-rate columns, the finance
  # admin role (which only existed to gate pay), the three timesheet tables, and
  # the timesheet grouping settings. There is no pay anywhere in the product.
  def up
    # Timesheet tables — drop in FK order (disputes -> lines -> periods).
    drop_table :timesheet_disputes
    drop_table :timesheet_lines
    drop_table :timesheet_periods

    # Timesheet grouping settings (pay-period / rounding) + currency: all
    # money/pay framing, and there is no pay in the product.
    remove_column :settings, :timesheet_period
    remove_column :settings, :timesheet_week_starts_on
    remove_column :settings, :timesheet_rounding_minutes
    remove_column :settings, :currency_code

    # Pay-rate columns on employees + their non-negative check constraints.
    remove_column :employees, :hourly_rate_pence
    remove_column :employees, :mileage_rate_pence

    # Drop the finance value from the admin_role enum. Postgres can't remove an
    # enum value in place, so recreate the type. No admin may hold 'finance'
    # (there are none) — but guard anyway so this fails loudly rather than
    # silently losing a role.
    if select_value("SELECT COUNT(*) FROM admins WHERE role = 'finance'").to_i.positive?
      raise "Cannot drop the finance role: admins still have it. Re-map them first."
    end
    rename_enum_value_safe
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end

  private

  def rename_enum_value_safe
    execute <<~SQL
      ALTER TYPE admin_role RENAME TO admin_role_old;
      CREATE TYPE admin_role AS ENUM ('registered_manager', 'manager', 'coordinator', 'auditor');
      ALTER TABLE admins ALTER COLUMN role DROP DEFAULT;
      ALTER TABLE admins
        ALTER COLUMN role TYPE admin_role USING role::text::admin_role;
      DROP TYPE admin_role_old;
    SQL
  end
end
