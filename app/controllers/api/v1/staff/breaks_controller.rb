module Api
  module V1
    module Staff
      # POST /api/v1/staff/visit_assignments/:visit_assignment_id/break
      #   { phase: "start" | "end", client_event_id, occurred_at, lat, lng }
      # Reuses the clock-event pipeline (idempotent, geofenced, audited) but does
      # not change the visit lifecycle.
      class BreaksController < BaseController
        def create
          va = current_employee.visit_assignments.assigned.find(params[:visit_assignment_id])
          kind = params[:phase].to_s == "end" ? "break_end" : "break_start"

          res = Clocking::RecordClockEvent.call(
            visit_assignment: va, actor: current_employee, on_block: :flag, kind: kind,
            # Required, like clock-in/out: it's the offline dedup key. Fabricating
            # one server-side would let a retry create a duplicate break event.
            client_event_id: params.require(:client_event_id),
            occurred_at: params[:occurred_at].presence || Time.current.iso8601,
            lat: params[:lat], lng: params[:lng], accuracy_m: params[:accuracy_m]
          )
          render json: { server_time: Time.current.iso8601, kind: kind, status: res.status.to_s },
                 status: (res.status == :replay ? :ok : :created)
        end
      end
    end
  end
end
