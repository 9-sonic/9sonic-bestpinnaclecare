module Api
  module V1
    module Admin
      # GET /api/v1/admin/exceptions — the review queue: visits needing an admin
      # decision plus all open alerts.
      class ExceptionsController < BaseController
        def index
          scope = VisitAssignment.assigned.where(lifecycle_state: :pending_review)
                                 .includes(:employee, visit: :service_user).order(:updated_at)
          page  = [ params.fetch(:page, 1).to_i, 1 ].max
          per   = params.fetch(:per_page, 50).to_i.clamp(1, 100)
          total = scope.count

          render json: {
            # include_employee so the queue can show who each anomaly is for.
            # The review queue is paginated (it grows); alerts are few and stay whole.
            pending_review: scope.offset((page - 1) * per).limit(per).map { |va|
              VisitAssignmentSerializer.call(va, include_service_user: true, include_employee: true)
            },
            pending_total: total,
            page: page,
            per_page: per,
            open_alerts: Alert.where(state: :open).order(raised_at: :desc).map { |a| AlertSerializer.call(a) }
          }
        end
      end
    end
  end
end
