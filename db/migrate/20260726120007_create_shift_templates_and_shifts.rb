class CreateShiftTemplatesAndShifts < ActiveRecord::Migration[8.1]
  def change
    create_enum :shift_status, %w[draft published cancelled]

    create_table :shift_templates do |t|
      t.references :location, foreign_key: true, index: false
      t.text    :name, null: false
      t.time    :start_time, null: false
      t.time    :end_time,   null: false
      t.text    :recurrence, null: false
      t.integer :staff_required, null: false, default: 1
      t.integer :break_minutes,  null: false, default: 0
      t.date    :effective_from, null: false
      t.date    :effective_to
      t.boolean :active, null: false, default: true
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
      t.column  :updated_at, :timestamptz, null: false, default: -> { "now()" }
    end
    add_check_constraint :shift_templates,
      "staff_required > 0 AND break_minutes >= 0", name: "shift_templates_positive"

    create_table :shifts do |t|
      t.references :shift_template, foreign_key: true, index: false
      t.references :location,       foreign_key: true, index: false
      t.column  :scheduled_start, :timestamptz, null: false
      t.column  :scheduled_end,   :timestamptz, null: false
      t.integer :break_minutes,  null: false, default: 0
      t.integer :staff_required, null: false, default: 1
      t.enum    :status, enum_type: "shift_status", null: false, default: "draft"
      t.column  :published_at, :timestamptz
      t.references :published_by_admin, foreign_key: { to_table: :admins }, index: false
      t.column  :cancelled_at, :timestamptz
      t.text    :cancellation_reason
      t.text    :notes
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
      t.column  :updated_at, :timestamptz, null: false, default: -> { "now()" }
    end
    add_check_constraint :shifts, "scheduled_end > scheduled_start", name: "shifts_end_after_start"
    add_index :shifts, :scheduled_start, name: "idx_shifts_start"
    add_index :shifts, [ :status, :scheduled_start ], name: "idx_shifts_status"
    add_index :shifts, [ :shift_template_id, :scheduled_start ],
      unique: true, where: "shift_template_id IS NOT NULL", name: "idx_shifts_template_slot"
  end
end
