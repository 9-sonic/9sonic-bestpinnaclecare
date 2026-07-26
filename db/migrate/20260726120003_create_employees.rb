class CreateEmployees < ActiveRecord::Migration[8.1]
  def change
    create_enum :employee_role, %w[carer senior_carer]

    create_table :employees do |t|
      t.column  :email, :citext, null: false
      t.text    :password_digest
      t.text    :first_name, null: false
      t.text    :last_name,  null: false
      t.text    :phone
      t.enum    :role, enum_type: "employee_role", null: false, default: "carer"
      t.text    :employee_reference
      t.text    :mfa_secret
      t.boolean :mfa_enabled, null: false, default: false  # optional for employees
      t.integer :failed_attempts, null: false, default: 0
      t.column  :locked_at,          :timestamptz
      t.column  :invited_at,         :timestamptz
      t.column  :accepted_invite_at, :timestamptz
      t.column  :last_sign_in_at,    :timestamptz
      t.boolean :active, null: false, default: true
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
      t.column  :updated_at, :timestamptz, null: false, default: -> { "now()" }
    end

    add_index :employees, :email, unique: true
    add_index :employees, :active, where: "active", name: "idx_employees_active"
  end
end
