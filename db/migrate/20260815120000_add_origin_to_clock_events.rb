class AddOriginToClockEvents < ActiveRecord::Migration[8.1]
  # How a clock event reached us — needed for the CQC visit-attendance audit,
  # which reports whether each clock-in/out was taken offline (queued in the
  # carer PWA's outbox) or live. Set at insert time only; clock_events are
  # append-only, so this is never updated.
  #
  #   live         — recorded by the live clock endpoint (device had connectivity)
  #   offline_sync — ingested from the PWA offline outbox (Sync::IngestBatch)
  #   manual_admin — an office correction (method = manual_admin)
  #
  # Existing rows default to live: they predate offline-origin tracking and
  # were not sync-ingested, so "live" is the honest value.
  def up
    create_enum :clock_origin, %w[live offline_sync manual_admin]
    add_column :clock_events, :origin, :enum, enum_type: "clock_origin",
               null: false, default: "live"
  end

  def down
    remove_column :clock_events, :origin
    drop_enum :clock_origin
  end
end
