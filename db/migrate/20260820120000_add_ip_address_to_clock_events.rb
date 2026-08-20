class AddIpAddressToClockEvents < ActiveRecord::Migration[8.1]
  # Capture the IP a clock tap arrived from — an EVV/attendance provenance
  # signal alongside device_fingerprint. Nullable: old events predate it and an
  # offline-synced tap may have no reliable IP at capture time.
  def change
    add_column :clock_events, :ip_address, :text
  end
end
