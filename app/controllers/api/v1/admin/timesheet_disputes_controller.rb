module Api
  module V1
    module Admin
      class TimesheetDisputesController < BaseController
        # Dispute resolution touches pay — managers/coordinators + finance.
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator, :finance) }, only: :resolve
        def index
          render json: TimesheetDispute.where(state: "open").includes(:raised_by).order(created_at: :desc)
                                       .map { |d| TimesheetDisputeSerializer.call(d) }
        end

        # POST /api/v1/admin/timesheet_disputes/:id/resolve
        def resolve
          dispute = TimesheetDispute.find(params[:id])
          dispute.update!(state: "resolved", resolved_by: current_admin, resolution_note: params[:resolution_note])
          render json: TimesheetDisputeSerializer.call(dispute)
        end
      end
    end
  end
end
