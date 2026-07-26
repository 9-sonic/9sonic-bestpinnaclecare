class CreateJwtDenylist < ActiveRecord::Migration[8.1]
  def change
    create_table :jwt_denylist do |t|
      t.string  :jti, null: false
      t.column  :exp, :timestamptz, null: false
    end
    add_index :jwt_denylist, :jti
  end
end
