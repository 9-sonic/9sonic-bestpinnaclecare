class CreateEmployeeAvailabilities < ActiveRecord::Migration[8.1]
  def change
    create_enum :availability_slot, %w[morning afternoon evening night]

    create_table :employee_availabilities do |t|
      t.references :employee, null: false, foreign_key: true, index: false
      t.integer :weekday, null: false                                 # 0 Monday .. 6 Sunday
      t.enum    :slot, enum_type: "availability_slot", null: false
      t.boolean :available, null: false, default: true
      t.date    :effective_from
      t.date    :effective_to
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
      t.column  :updated_at, :timestamptz, null: false, default: -> { "now()" }
    end

    add_index :employee_availabilities, %i[employee_id weekday slot], unique: true, name: "idx_employee_availability_unique"
    add_check_constraint :employee_availabilities, "weekday BETWEEN 0 AND 6", name: "employee_availability_weekday_range"
  end
end
