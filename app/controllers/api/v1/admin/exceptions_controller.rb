module Api
  module V1
    module Admin
      # GET /api/v1/admin/exceptions — the review queue: visits needing an admin
      # decision plus all open alerts.
      class ExceptionsController < BaseController
        def index
          pending = VisitAssignment.assigned.where(lifecycle_state: :pending_review)
                                   .includes(:employee, visit: :service_user).order(:updated_at)
          render json: {
            # include_employee so the queue can show who each anomaly is for.
            pending_review: pending.map { |va| VisitAssignmentSerializer.call(va, include_service_user: true, include_employee: true) },
            open_alerts: Alert.where(state: :open).order(raised_at: :desc).map { |a| AlertSerializer.call(a) }
          }
        end
      end
    end
  end
end
