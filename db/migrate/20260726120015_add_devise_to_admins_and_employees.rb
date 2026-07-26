class AddDeviseToAdminsAndEmployees < ActiveRecord::Migration[8.1]
  def up
    %i[admins employees].each do |t|
      # database_authenticatable: Devise stores the bcrypt hash in encrypted_password.
      rename_column t, :password_digest, :encrypted_password
      change_column_null    t, :encrypted_password, false, ""
      change_column_default t, :encrypted_password, ""

      # recoverable
      add_column t, :reset_password_token,   :string
      add_column t, :reset_password_sent_at, :timestamptz
      # lockable (failed_attempts + locked_at already exist from the original schema)
      add_column t, :unlock_token, :string

      add_index t, :reset_password_token, unique: true
      add_index t, :unlock_token,         unique: true
    end
  end

  def down
    %i[admins employees].each do |t|
      remove_index  t, :reset_password_token
      remove_index  t, :unlock_token
      remove_column t, :reset_password_token
      remove_column t, :reset_password_sent_at
      remove_column t, :unlock_token
      change_column_default t, :encrypted_password, nil
      rename_column t, :encrypted_password, :password_digest
    end
  end
end
