class CreateShiftAssignments < ActiveRecord::Migration[8.1]
  def change
    create_enum :lifecycle_state,
      %w[scheduled check_in_window grace_period late in_progress overdue pending_review completed missed cancelled]

    create_table :shift_assignments do |t|
      t.references :shift,    null: false, foreign_key: true, index: false
      t.references :employee, null: false, foreign_key: true, index: false
      t.text    :role,              null: false, default: "worker"     # worker|supervisor|shadow
      t.text    :assignment_status, null: false, default: "assigned"   # assigned|withdrawn
      t.enum    :lifecycle_state,   enum_type: "lifecycle_state", null: false, default: "scheduled"
      t.column  :actual_start, :timestamptz
      t.column  :actual_end,   :timestamptz
      t.integer :worked_minutes
      t.text    :flags, array: true, null: false, default: []
      t.text    :override_reason
      t.references :assigned_by_admin, foreign_key: { to_table: :admins }, index: false
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
      t.column  :updated_at, :timestamptz, null: false, default: -> { "now()" }
    end

    add_index :shift_assignments, [ :shift_id, :employee_id ],
      unique: true, where: "assignment_status = 'assigned'", name: "idx_assignments_unique"
    add_index :shift_assignments, [ :employee_id, :lifecycle_state ], name: "idx_assignments_employee"
    add_index :shift_assignments, :lifecycle_state, name: "idx_assignments_state"
  end
end
