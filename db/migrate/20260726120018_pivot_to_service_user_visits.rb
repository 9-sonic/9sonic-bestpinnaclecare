class PivotToServiceUserVisits < ActiveRecord::Migration[8.1]
  def up
    # 1. Service users — the geofence anchor (their home). Not an auth identity.
    create_table :service_users do |t|
      t.text    :first_name, null: false
      t.text    :last_name,  null: false
      t.text    :reference
      t.date    :date_of_birth
      t.text    :phone
      t.text    :address_line1
      t.text    :address_line2
      t.text    :city
      t.text    :postcode
      t.decimal :lat, precision: 10, scale: 7
      t.decimal :lng, precision: 10, scale: 7
      t.integer :geofence_radius_m, null: false, default: 150
      t.text    :geofence_mode          # optional per-user override of settings
      t.text    :access_notes           # key-safe / entry info for the arriving carer
      t.boolean :active, null: false, default: true
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
      t.column  :updated_at, :timestamptz, null: false, default: -> { "now()" }
    end
    add_index :service_users, :active, where: "active", name: "idx_service_users_active"

    # 2. shift_templates -> care_package_slots (recurring call attached to a service user)
    rename_table  :shift_templates, :care_package_slots
    remove_column :care_package_slots, :location_id
    add_reference :care_package_slots, :service_user, null: false, foreign_key: true

    # 3. shifts -> visits (one dated call to one service user)
    rename_table  :shifts, :visits
    rename_column :visits, :shift_template_id, :care_package_slot_id
    remove_column :visits, :location_id
    add_reference :visits, :service_user, null: false, foreign_key: true

    # 4. shift_assignments -> visit_assignments
    rename_table  :shift_assignments, :visit_assignments
    rename_column :visit_assignments, :shift_id, :visit_id

    # 5. Child FK columns follow the rename
    rename_column :clock_events,    :shift_assignment_id, :visit_assignment_id
    rename_column :timesheet_lines, :shift_assignment_id, :visit_assignment_id

    # 6. Retire locations — the home on service_users is the anchor now
    drop_table :locations
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
