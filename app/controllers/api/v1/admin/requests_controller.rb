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

          # Approving a "drop" actually hands the shift back: withdraw the carer
          # from the visit so it becomes unfilled and lands in the Cover board,
          # ready to reassign. Without this the drop was recorded but the visit
          # stayed on the carer's rota and never surfaced for cover.
          apply_drop(req) if state == "approved" && req.kind == "drop"

          notify_carer(req, state)

          render json: CarerRequestSerializer.call(req)
        end

        # Tell the carer their request was decided, and carry the manager's note
        # (their reply) so the office answer actually reaches the person who
        # asked. Without this the decision — and any note the manager wrote — sat
        # on the record and the carer was never told.
        def notify_carer(req, state)
          verb  = state == "approved" ? "approved" : "declined"
          title = "Your #{req.kind} request was #{verb}"
          body  = [ req.summary, req.decision_note.presence ].compact.join(" — ")
          Notifications::Deliver.call(
            recipients: req.employee, category: "request", kind: "request_#{verb}",
            title: title, body: body, subject: req, channels: %w[in_app push]
          )
        end

        # Withdraw the requesting carer from the visit the drop names. Audited
        # (assignment.withdrawn) — the original assignment row is preserved, its
        # status flipped, mirroring the manual withdraw path. Guarded so an
        # already-ended/withdrawn assignment is left untouched.
        def apply_drop(req)
          va_id = req.payload&.dig("visit_assignment_id") || req.payload&.dig(:visit_assignment_id)
          return if va_id.blank?

          va = VisitAssignment.find_by(id: va_id, employee_id: req.employee_id)
          return if va.nil? || va.assignment_status != "assigned"
          return if %w[completed missed cancelled].include?(va.lifecycle_state)
          # Only withdraw from a PUBLISHED visit — Cover only surfaces published
          # visits, so withdrawing from a draft would make the visit vanish (off
          # the carer's rota AND absent from Cover). A draft is still the office's
          # to plan; the approval is recorded, but the roster is left for them.
          return unless va.visit.published?

          va.update!(assignment_status: "withdrawn", lifecycle_state: :cancelled)
          Events::Record.call(
            aggregate: va, actor: current_admin, event_type: "assignment.withdrawn",
            payload: { visit_id: va.visit_id, employee_id: va.employee_id, via: "drop_request", request_id: req.id }
          )
        end
      end
    end
  end
end
