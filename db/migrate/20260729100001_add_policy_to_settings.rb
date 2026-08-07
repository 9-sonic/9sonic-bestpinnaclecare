class AddPolicyToSettings < ActiveRecord::Migration[8.1]
  def change
    add_column :settings, :policy, :jsonb, null: false, default: {}
  end
end
