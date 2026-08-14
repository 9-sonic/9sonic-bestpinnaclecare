module Api
  module V1
    module Admin
      # POST /api/v1/admin/clock_corrections — an admin inserts a manual_admin
      # clock event (append-only) with a mandatory reason, optionally correcting
      # an existing event via corrects_id.
      class ClockCorrectionsController < BaseController
        # Corrections rewrite the attendance record that drives pay — restricted
        # to the roles that own scheduling/attendance.
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) }, only: :create

        def create
          va = VisitAssignment.find(params.require(:visit_assignment_id))

          res = Clocking::RecordClockEvent.call(
            visit_assignment: va, actor: current_admin, method: "manual_admin", on_block: :flag,
            kind:            correction_params[:kind],
            client_event_id: correction_params[:client_event_id].presence || SecureRandom.uuid,
            occurred_at:     correction_params[:occurred_at],
            lat:             correction_params[:lat],
            lng:             correction_params[:lng],
            reason:          correction_params[:reason],
            corrects_id:     correction_params[:corrects_id]
          )

          Events::Record.call(
            aggregate: va, actor: current_admin, event_type: "clock.corrected",
            payload: {
              kind:        correction_params[:kind],
              reason:      correction_params[:reason],
              occurred_at: correction_params[:occurred_at],
              corrects_id: correction_params[:corrects_id]
            }.compact
          )

          # Keep pay in sync: rebuild the timesheet line so the correction reaches
          # payroll. A locked period is left untouched but flagged for re-approval.
          timesheet_status = Timesheets::RebuildForVisit.call(va.reload)
          if timesheet_status == :locked
            Events::Record.call(
              aggregate: va, actor: current_admin, event_type: "timesheet.needs_reapproval",
              payload: { reason: "clock corrected on a locked period" }
            )
          end

          render json: {
            clock_event:      ClockEventSerializer.call(res.clock_event),
            lifecycle_state:  res.lifecycle_state,
            timesheet_status: timesheet_status
          }, status: :created
        end

        private

        def correction_params
          params.permit(:visit_assignment_id, :kind, :occurred_at, :lat, :lng, :reason, :corrects_id, :client_event_id)
        end
      end
    end
  end
end
