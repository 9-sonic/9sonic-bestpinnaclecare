class CreateCarerRequests < ActiveRecord::Migration[8.1]
  def change
    create_table :carer_requests do |t|
      t.references :employee, null: false, foreign_key: true
      t.text  :kind,    null: false                       # swap | drop | overtime | availability | leave
      t.text  :state,   null: false, default: "pending"   # pending | approved | declined | cancelled
      t.text  :summary, null: false
      t.text  :detail
      t.jsonb :payload, null: false, default: {}
      t.bigint :decided_by_admin_id
      t.text :decision_note
      t.column :decided_at, :timestamptz
      t.column :created_at, :timestamptz, null: false, default: -> { "now()" }
      t.column :updated_at, :timestamptz, null: false, default: -> { "now()" }
    end

    add_index :carer_requests, %i[state created_at]
    add_foreign_key :carer_requests, :admins, column: :decided_by_admin_id
    add_check_constraint :carer_requests,
                         "kind IN ('swap','drop','overtime','availability','leave')",
                         name: "carer_requests_kind_valid"
    add_check_constraint :carer_requests,
                         "state IN ('pending','approved','declined','cancelled')",
                         name: "carer_requests_state_valid"
  end
end
