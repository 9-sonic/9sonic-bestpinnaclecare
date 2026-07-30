class CreateMileageClaims < ActiveRecord::Migration[8.1]
  def change
    create_table :mileage_claims do |t|
      t.references :employee, null: false, foreign_key: true, index: false
      t.references :visit_assignment, foreign_key: true
      t.date    :travel_date, null: false
      t.decimal :miles, precision: 6, scale: 2, null: false
      t.text    :from_label
      t.text    :to_label
      t.text    :source, null: false, default: "carer"     # carer | calculated
      t.text    :state,  null: false, default: "claimed"   # claimed | approved | rejected
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
    end
    add_index :mileage_claims, %i[employee_id travel_date]
    add_check_constraint :mileage_claims, "miles >= 0", name: "mileage_non_negative"
  end
end
