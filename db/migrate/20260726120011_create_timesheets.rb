class CreateTimesheets < ActiveRecord::Migration[8.1]
  def change
    create_table :timesheet_periods do |t|
      t.date   :starts_on, null: false
      t.date   :ends_on,   null: false
      t.string :status, null: false, default: "open"     # string enum: open|approved|locked
      t.references :approved_by_admin, foreign_key: { to_table: :admins }, index: false
      t.column :approved_at, :timestamptz
      t.column :locked_at,   :timestamptz
    end
    add_index :timesheet_periods, :starts_on, unique: true
    add_check_constraint :timesheet_periods, "ends_on >= starts_on", name: "timesheet_periods_range"

    create_table :timesheet_lines do |t|
      t.references :timesheet_period,  null: false, foreign_key: true, index: false
      t.references :employee,          null: false, foreign_key: true, index: false
      t.references :shift_assignment,  null: false, foreign_key: true, index: false
      t.date    :work_date, null: false                  # overnight => shift START date
      t.integer :scheduled_minutes, null: false
      t.integer :worked_minutes,    null: false          # exact; rounding at export
      t.integer :break_minutes,     null: false, default: 0
      t.text    :flags, array: true, null: false, default: []
    end
    add_index :timesheet_lines, [ :timesheet_period_id, :shift_assignment_id ], unique: true
    add_index :timesheet_lines, [ :employee_id, :work_date ], name: "idx_timesheet_lines_employee"

    create_table :timesheet_disputes do |t|
      t.references :timesheet_line, null: false, foreign_key: true, index: false
      t.references :raised_by_employee, null: false, foreign_key: { to_table: :employees }, index: false
      t.text    :reason, null: false
      t.text    :state,  null: false, default: "open"
      t.references :resolved_by_admin, foreign_key: { to_table: :admins }, index: false
      t.text    :resolution_note
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
    end
  end
end
