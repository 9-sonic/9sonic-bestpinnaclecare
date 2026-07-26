module Notifications
  # Who hears about a thing. Operational alerts go to the active office admins.
  class ResolveRecipients
    def self.for_alert(_alert) = Admin.active.to_a
  end
end
