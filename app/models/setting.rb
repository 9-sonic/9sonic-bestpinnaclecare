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

  # May one carer hold two or more visits that overlap in time?
  #
  # Best Pinnacle asked for this to be ON (confirmed via the office, 2026-09-04):
  # a carer may be booked on any number of overlapping visits for different
  # clients. It stays a setting rather than a code change so it can be turned
  # back off without a deploy, and so a future provider can differ.
  #
  # Turning it on does NOT silence the check — Assignments::Validate still
  # returns the "Overlaps another assigned visit" warning, which the office sees
  # on every assignment. It stops being a refusal and becomes a caution.
  #
  # This is only about the CARER side. "One client, one carer at a time"
  # (Validate.client_conflict) is a separate rule and is untouched.
  def allow_carer_double_booking?
    policy.fetch("allow_carer_double_booking", true)
  end
end
