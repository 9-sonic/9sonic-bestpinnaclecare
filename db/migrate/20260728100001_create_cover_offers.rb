class CreateCoverOffers < ActiveRecord::Migration[8.1]
  def change
    create_table :cover_offers do |t|
      t.references :visit,    null: false, foreign_key: true
      t.references :employee, null: false, foreign_key: true, index: false
      t.bigint  :offered_by_admin_id
      t.text    :state, null: false, default: "pending"   # pending | accepted | declined | withdrawn
      t.text    :note
      t.column  :offered_at,   :timestamptz, null: false, default: -> { "now()" }
      t.column  :responded_at, :timestamptz
      t.column  :created_at,   :timestamptz, null: false, default: -> { "now()" }
      t.column  :updated_at,   :timestamptz, null: false, default: -> { "now()" }
    end

    add_index :cover_offers, %i[visit_id employee_id], unique: true, name: "idx_cover_offers_unique"
    add_index :cover_offers, %i[employee_id state]
    add_foreign_key :cover_offers, :admins, column: :offered_by_admin_id
    add_check_constraint :cover_offers,
                         "state IN ('pending','accepted','declined','withdrawn')",
                         name: "cover_offers_state_valid"
  end
end
