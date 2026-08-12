class AddApprovalToTimesheetLines < ActiveRecord::Migration[8.1]
  # Per-carer timesheet approval: a coordinator can approve one carer's lines
  # within a period without approving the whole agency. Additive — the existing
  # period-wide approve/lock is unchanged; these columns just record who signed
  # off an individual line and when.
  def change
    add_column :timesheet_lines, :approved_at, :timestamptz
    add_reference :timesheet_lines, :approved_by_admin, foreign_key: { to_table: :admins }, null: true
  end
end
