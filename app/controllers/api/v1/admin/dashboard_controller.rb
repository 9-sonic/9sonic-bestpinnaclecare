module Api
  module V1
    module Admin
      # GET /api/v1/admin/dashboard — headline numbers for the office landing page.
      class DashboardController < BaseController
        def index
          today = Date.current
          today_range = today.beginning_of_day..today.end_of_day

          today_states = VisitAssignment.assigned.joins(:visit)
                                        .where(visits: { scheduled_start: today_range })
                                        .group(:lifecycle_state).count

          unassigned = Visit.published
                            .where(scheduled_start: today.beginning_of_day..(today + 7).end_of_day)
                            .left_joins(:visit_assignments)
                            .where(visit_assignments: { id: nil }).count

          render json: {
            date:                today.iso8601,
            today_counts:        today_states,
            open_alerts:         Alert.where(state: :open).count,
            pending_review:      VisitAssignment.assigned.where(lifecycle_state: :pending_review).count,
            unassigned_upcoming: unassigned
          }
        end
      end
    end
  end
end
