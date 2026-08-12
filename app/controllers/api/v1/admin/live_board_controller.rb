module Api
  module V1
    module Admin
      # GET /api/v1/admin/live_board — today's assigned visits with live state + counts.
      class LiveBoardController < BaseController
        def index
          today = Date.current
          vas = VisitAssignment.assigned.joins(:visit).includes(:employee, visit: :service_user)
                               .where(visits: { scheduled_start: today.beginning_of_day..today.end_of_day })
                               .order("visits.scheduled_start")
                               .to_a

          render json: {
            date:        today.iso8601,
            counts:      vas.group_by(&:lifecycle_state).transform_values(&:size),
            assignments: vas.map { |va| VisitAssignmentSerializer.call(va, include_service_user: true, include_employee: true) }
          }
        end
      end
    end
  end
end
