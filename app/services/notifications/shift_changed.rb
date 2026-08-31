module Notifications
  # A lightweight "your rota changed — refetch" ping to a carer's live socket, so
  # the PWA calendar updates the moment the office changes their shifts, instead
  # of only on the next open/poll.
  #
  # Deliberately NOT a Notification: it writes no DB row and rings no bell. It's
  # a UI-refresh signal only, fired on ANY change that affects what's on a carer's
  # calendar — publish, assign, reassign, withdraw, cancel — including removals,
  # where a "New shift" notification would be wrong but the calendar still needs
  # to drop the visit. The carer-facing "you're on for this" alert is a separate
  # concern (see ShiftAssigned).
  #
  # Same inbox address and channel the bell/chat use ("inbox:<Class>:<id>"), so
  # the one PWA subscription already open receives it; the client filters on
  # payload type "shift" and refetches its own shift list (single source of
  # truth), exactly like it does for notifications.
  class ShiftChanged
    # employees: one Employee, an array, or nil. Nils/blanks are ignored, so
    # callers can pass e.g. [old_carer, new_carer] on a reassignment freely.
    def self.call(employees)
      Array(employees).compact.uniq.each do |employee|
        ActionCable.server.broadcast(
          "inbox:#{employee.class.name}:#{employee.id}",
          { type: "shift" }
        )
      rescue StandardError => e
        # Best-effort: a socket problem must never fail the rota change itself.
        Rails.logger.warn("[cable] shift-changed broadcast failed: #{e.message}")
      end
    end
  end
end
