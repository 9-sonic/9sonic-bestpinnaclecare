class SetLateGraceMinutesTo15 < ActiveRecord::Migration[8.1]
  # Grace is 15 minutes after the scheduled start. Once it passes with no
  # clock-in, the office is alerted so they can contact the carer or reassign —
  # the old 30-minute wait landed the alert at (or after) the end of a short
  # visit, too late to act. See Lifecycle::EvaluateAssignment.
  def up
    change_column_default :settings, :late_grace_minutes, from: 5, to: 15
    # change_column_default doesn't touch existing rows — bump the live setting
    # unless an admin has already customised it away from the old default.
    execute "UPDATE settings SET late_grace_minutes = 15 WHERE late_grace_minutes = 5"
  end

  def down
    change_column_default :settings, :late_grace_minutes, from: 15, to: 5
    execute "UPDATE settings SET late_grace_minutes = 5 WHERE late_grace_minutes = 15"
  end
end
