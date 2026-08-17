module Api
  module V1
    module Staff
      # The carer side: raise a request and see your own.
      # GET  /api/v1/staff/requests
      # POST /api/v1/staff/requests  { kind, summary, detail, payload }
      class RequestsController < BaseController
        def index
          render json: current_employee.carer_requests.order(created_at: :desc).map { |r| CarerRequestSerializer.call(r) }
        end

        def create
          if (err = drop_error)
            return render json: { error: err }, status: :unprocessable_entity
          end

          req = current_employee.carer_requests.create!(request_params.merge(state: "pending"))

          Events::Record.call(
            aggregate: req, actor: current_employee, event_type: "request.raised",
            payload: { kind: req.kind }
          )
          render json: CarerRequestSerializer.call(req), status: :created
        end

        private

        def request_params
          params.permit(:kind, :summary, :detail, payload: {})
        end

        # A carer can't request cover (kind "drop") on a visit that's no longer
        # theirs to hand back — one that's already completed, missed or
        # cancelled. The shift already happened (or was withdrawn); there is
        # nothing left to cover.
        def drop_error
          return nil unless request_params[:kind] == "drop"

          va_id = request_params.dig(:payload, :visit_assignment_id)
          return nil if va_id.blank?

          va = current_employee.visit_assignments.find_by(id: va_id)
          return "assignment_not_found" if va.nil?
          return "visit_already_over" if %w[completed missed cancelled].include?(va.lifecycle_state)

          nil
        end
      end
    end
  end
end
