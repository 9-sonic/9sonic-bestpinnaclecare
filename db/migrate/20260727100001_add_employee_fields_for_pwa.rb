class AddEmployeeFieldsForPwa < ActiveRecord::Migration[8.1]
  def change
    add_column :employees, :emergency_contact_name,    :text
    add_column :employees, :emergency_contact_phone,   :text
    add_column :employees, :hourly_rate_pence,         :integer   # money in pence, no floats
    add_column :employees, :mileage_rate_pence,        :integer
    add_column :employees, :contracted_hours_per_week, :decimal, precision: 5, scale: 2

    add_check_constraint :employees, "hourly_rate_pence IS NULL OR hourly_rate_pence >= 0",
                         name: "employees_hourly_rate_non_negative"
    add_check_constraint :employees, "mileage_rate_pence IS NULL OR mileage_rate_pence >= 0",
                         name: "employees_mileage_rate_non_negative"
  end
end
