class AddMfaConfirmationColumns < ActiveRecord::Migration[8.1]
  def change
    %i[admins employees].each do |t|
      # mfa_secret + mfa_enabled already exist. Confirmation gates activation:
      # a secret is only "live" once a code has been verified.
      add_column t, :mfa_confirmed_at, :timestamptz
      add_column t, :mfa_backup_codes, :text, array: true, null: false, default: []
    end
  end
end
