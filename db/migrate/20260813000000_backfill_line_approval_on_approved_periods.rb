class BackfillLineApprovalOnApprovedPeriods < ActiveRecord::Migration[8.1]
  # Per-line approval was added after some periods had already been signed off
  # the old (period-wide) way, leaving those periods 'approved'/'locked' while
  # every line stayed unapproved. Reconcile the data: a line in an approved or
  # locked period is approved, stamped with the period's approver and time.
  def up
    execute(<<~SQL)
      UPDATE timesheet_lines l
      SET approved_at = COALESCE(p.approved_at, p.locked_at, now()),
          approved_by_admin_id = p.approved_by_admin_id
      FROM timesheet_periods p
      WHERE l.timesheet_period_id = p.id
        AND p.status IN ('approved', 'locked')
        AND l.approved_at IS NULL
    SQL
  end

  def down
    # No safe inverse — approval state isn't reconstructable. Leave data as-is.
  end
end
