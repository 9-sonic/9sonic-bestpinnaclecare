module Api
  module V1
    module Admin
      # GET  /api/v1/admin/requests              — carer requests, pending first
      # POST /api/v1/admin/requests/:id/approve
      # POST /api/v1/admin/requests/:id/decline
      #
      # Approving or declining is audited. What a decision *does* to the rota
      # (moving visits, applying leave) is left to the manager acting on it —
      # this queue records the decision, it does not silently mutate the roster.
      class RequestsController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) }, only: %i[approve decline]
        def index
          scope = CarerRequest.includes(:employee, :decided_by)
                              .order(Arel.sql("CASE WHEN state = 'pending' THEN 0 ELSE 1 END"), created_at: :desc)
          scope = scope.where(kind: params[:kind])   if params[:kind].present?
          scope = scope.where(state: params[:state]) if params[:state].present?
          paginate(scope) { |r| CarerRequestSerializer.call(r) }
        end

        def approve = decide("approved", "request.approved")
        def decline = decide("declined", "request.declined")

        private

        def decide(state, event_type)
          req = CarerRequest.find(params[:id])
          req.update!(state: state, decided_by: current_admin, decided_at: Time.current, decision_note: params[:note])

          Events::Record.call(
            aggregate: req, actor: current_admin, event_type: event_type,
            payload: { kind: req.kind, employee_id: req.employee_id }
          )
          render json: CarerRequestSerializer.call(req)
        end
      end
    end
  end
end
