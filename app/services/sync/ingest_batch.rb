module Sync
  # Ingests a batch of clock events from the carer PWA's offline outbox. Each
  # event is idempotent (client_event_id) and recorded with on_block: :flag —
  # offline out-of-range clock-ins are recorded + flagged, never dropped.
  class IngestBatch
    def self.call(employee:, events:)
      Array(events).map { |e| ingest_one(employee, e.to_h.symbolize_keys) }
    end

    def self.ingest_one(employee, e)
      va = employee.visit_assignments.assigned.find_by(id: e[:visit_assignment_id])
      return { client_event_id: e[:client_event_id], status: "rejected", error: "not_your_visit" } unless va

      res = Clocking::RecordClockEvent.call(
        visit_assignment: va, kind: e[:kind], client_event_id: e[:client_event_id],
        occurred_at: e[:occurred_at], lat: e[:lat], lng: e[:lng], accuracy_m: e[:accuracy_m],
        device_fingerprint: e[:device_fingerprint], actor: employee, on_block: :flag
      )
      {
        client_event_id: e[:client_event_id], status: res.status.to_s,
        geofence: res.geofence_result, lifecycle_state: res.lifecycle_state, distance_m: res.distance_m
      }
    end
  end
end
