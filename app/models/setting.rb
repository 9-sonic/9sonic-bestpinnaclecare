# Single-row, in-app-editable provider configuration (id is always 1).
class Setting < ApplicationRecord
  # Placeholder used only when the singleton is auto-created on a fresh
  # environment (company_name is NOT NULL with no DB default). The registered
  # manager renames it on the settings screen; every other column has a sane
  # DB default, so this is the one value we must supply to stand the row up.
  DEFAULT_COMPANY_NAME = "Your care company".freeze

  # first_or_create! (not first_or_create) so a race raises rather than silently
  # returning an unsaved record; id: 1 satisfies the single-row check constraint.
  def self.instance = first_or_create!(id: 1) { |s| s.company_name = DEFAULT_COMPANY_NAME }

  def geofence_for(service_user)
    # .presence so a blank ("") per-user mode falls back to the global setting
    # rather than being treated as a real value (which is neither "block" nor
    # "off", so it would silently stop enforcing).
    { mode:   service_user&.geofence_mode.presence || geofence_mode.presence || "block",
      radius: service_user&.geofence_radius_m || geofence_radius_m }
  end
end
