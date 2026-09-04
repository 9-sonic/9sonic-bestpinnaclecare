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

  # Single geofence policy: a carer may only clock in at the client's location,
  # within a fixed 150 m radius. There is no warn/off mode and no adjustable
  # radius — every clock-in is enforced (block) at the same distance, so the
  # stored geofence_mode / geofence_radius_m columns are intentionally ignored.
  GEOFENCE_RADIUS_M = 150

  def geofence_for(_service_user)
    { mode: "block", radius: GEOFENCE_RADIUS_M }
  end
end
