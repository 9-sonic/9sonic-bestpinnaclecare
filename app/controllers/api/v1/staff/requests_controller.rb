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
      end
    end
  end
end
