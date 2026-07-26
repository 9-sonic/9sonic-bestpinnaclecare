module Api
  module V1
    module Staff
      # POST /api/v1/staff/visit_assignments/:visit_assignment_id/clock
      # Live (online) clock-in/out — geofence blocks are rejected (422 too_far).
      class ClockController < BaseController
        def create
          va = current_employee.visit_assignments.assigned.find(params[:visit_assignment_id])

          res = Clocking::RecordClockEvent.call(
            visit_assignment: va, actor: current_employee, on_block: :reject,
            kind:               clock_params[:kind],
            client_event_id:    clock_params[:client_event_id],
            occurred_at:        clock_params[:occurred_at],
            lat:                clock_params[:lat],
            lng:                clock_params[:lng],
            accuracy_m:         clock_params[:accuracy_m],
            device_fingerprint: clock_params[:device_fingerprint]
          )

          case res.status
          when :blocked
            render json: { error: res.error, distance_m: res.distance_m }, status: 422
          when :replay
            render json: clock_response(res), status: :ok
          else
            render json: clock_response(res), status: :created
          end
        end

        private

        def clock_response(res)
          {
            server_time:     Time.current.iso8601,
            lifecycle_state: res.lifecycle_state,
            geofence:        res.geofence_result,
            distance_m:      res.distance_m
          }
        end

        def clock_params
          params.permit(:kind, :client_event_id, :occurred_at, :lat, :lng, :accuracy_m, :device_fingerprint)
        end
      end
    end
  end
end
