module Api
  module V1
    module Staff
      # Offline outbox sync for the carer PWA.
      class SyncController < BaseController
        # POST /api/v1/staff/sync/events  { events: [ {...}, ... ] }
        # Batched, idempotent ingest of clock events captured offline.
        def events
          results = Sync::IngestBatch.call(employee: current_employee, events: event_list)
          render json: { results: results }, status: :ok
        end

        # GET /api/v1/staff/sync/changes?since=<iso8601>
        # The carer's upcoming visits + service-user home coords to cache offline.
        def changes
          since = params[:since].present? ? Time.zone.parse(params[:since]) : nil
          render json: Sync::BuildChangeset.call(employee: current_employee, since: since)
        end

        private

        def event_list
          params.permit(events: [ :visit_assignment_id, :kind, :client_event_id, :occurred_at,
                                   :lat, :lng, :accuracy_m, :device_fingerprint ])[:events] || []
        end
      end
    end
  end
end
