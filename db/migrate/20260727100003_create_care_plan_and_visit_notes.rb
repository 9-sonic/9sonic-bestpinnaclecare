class CreateCarePlanAndVisitNotes < ActiveRecord::Migration[8.1]
  def change
    # What the carer should do — held against the person, not the visit.
    create_table :care_plan_items do |t|
      t.references :service_user, null: false, foreign_key: true, index: false
      t.text    :category, null: false     # medication | nutrition | mobility | allergy | ...
      t.text    :label,    null: false
      t.text    :detail
      t.integer :position, null: false, default: 0
      t.boolean :active,   null: false, default: true
      t.column  :created_at, :timestamptz, null: false, default: -> { "now()" }
      t.column  :updated_at, :timestamptz, null: false, default: -> { "now()" }
    end
    add_index :care_plan_items, %i[service_user_id position]

    # What was actually done — per visit.
    create_table :visit_tasks do |t|
      t.references :visit_assignment, null: false, foreign_key: true
      t.references :care_plan_item, foreign_key: true
      t.text    :label, null: false
      t.boolean :done, null: false, default: false
      t.column  :completed_at, :timestamptz
      t.column  :created_at,   :timestamptz, null: false, default: -> { "now()" }
    end

    # The carer's write-up. Append-only: an edit adds a superseding row.
    create_table :visit_notes do |t|
      t.references :visit_assignment, null: false, foreign_key: true, index: false
      t.references :author, polymorphic: true, null: false
      t.text   :body, null: false
      t.uuid   :client_note_id, null: false     # idempotent, same idea as client_event_id
      t.bigint :supersedes_id
      t.column :created_at, :timestamptz, null: false, default: -> { "now()" }
    end
    add_index :visit_notes, :client_note_id, unique: true
    add_index :visit_notes, %i[visit_assignment_id created_at]
    add_foreign_key :visit_notes, :visit_notes, column: :supersedes_id
  end
end
