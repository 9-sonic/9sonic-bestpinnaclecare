class RemoveSeniorCarerRole < ActiveRecord::Migration[8.1]
  # The carer/senior_carer split had no behaviour behind it — every carer had
  # identical access. Collapse it: everyone is simply a carer.
  def up
    execute "UPDATE employees SET role = 'carer' WHERE role = 'senior_carer'"

    # Postgres can't DROP a value from an enum, so recreate the type with carer only.
    execute "ALTER TABLE employees ALTER COLUMN role DROP DEFAULT"
    execute "ALTER TYPE employee_role RENAME TO employee_role_old"
    execute "CREATE TYPE employee_role AS ENUM ('carer')"
    execute "ALTER TABLE employees ALTER COLUMN role TYPE employee_role USING role::text::employee_role"
    execute "ALTER TABLE employees ALTER COLUMN role SET DEFAULT 'carer'"
    execute "DROP TYPE employee_role_old"
  end

  def down
    execute "ALTER TYPE employee_role ADD VALUE IF NOT EXISTS 'senior_carer'"
  end
end
