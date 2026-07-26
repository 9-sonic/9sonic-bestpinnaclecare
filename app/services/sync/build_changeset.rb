module Sync
  # Builds the download changeset the PWA caches for offline clocking: the
  # carer's non-terminal assigned visits, each with the service user's home
  # coords/radius/access notes so the device can do the provisional geofence.
  class BuildChangeset
    def self.call(employee:, since: nil)
      scope = employee.visit_assignments.assigned.non_terminal.includes(visit: :service_user)
      scope = scope.where("visit_assignments.updated_at > ?", since) if since.present?
      assignments = scope.order("visit_assignments.updated_at").to_a

      {
        server_time: Time.current.iso8601,
        cursor:      (assignments.last&.updated_at || since || Time.current).iso8601,
        visits:      assignments.map { |va| VisitAssignmentSerializer.call(va, include_service_user: true) }
      }
    end
  end
end
