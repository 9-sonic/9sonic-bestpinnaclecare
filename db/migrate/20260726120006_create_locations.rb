class CreateLocations < ActiveRecord::Migration[8.1]
  def change
    create_table :locations do |t|
      t.text    :name, null: false
      t.text    :address_line1
      t.text    :address_line2
      t.text    :city
      t.text    :postcode
      t.decimal :lat, precision: 10, scale: 7
      t.decimal :lng, precision: 10, scale: 7
      t.integer :geofence_radius_m
      t.text    :geofence_mode
      t.boolean :active, null: false, default: true
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
      t.column  :updated_at, :timestamptz, null: false, default: -> { "now()" }
    end
  end
end
