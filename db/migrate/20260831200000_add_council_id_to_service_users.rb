class AddCouncilIdToServiceUsers < ActiveRecord::Migration[8.1]
  # The commissioning local authority's own identifier for this client (from the
  # RoundSys export's "Council Service User ID"). Kept separate from `reference`,
  # which is OUR stable client code (SU-XXXX) — they're different systems' IDs and
  # shouldn't be conflated. Nullable: not every client has a council ID (e.g.
  # privately-funded, or a CHC case not yet linked).
  def change
    add_column :service_users, :council_id, :text
  end
end
