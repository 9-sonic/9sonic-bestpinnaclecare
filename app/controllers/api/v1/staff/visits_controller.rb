module Api
  module V1
    module Staff
      # GET /api/v1/staff/visits?from=&to=  — the carer's own assigned visits.
      class VisitsController < BaseController
        def index
          from = params[:from].present? ? Date.parse(params[:from]) : Date.current
          to   = params[:to].present?   ? Date.parse(params[:to])   : from + 6
          # Only PUBLISHED visits reach the carer. A draft is the office still
          # planning the week — publishing is what releases it to carers. (A
          # cancelled visit drops off separately: cancel withdraws the
          # assignment, and `.assigned` already excludes withdrawn ones.)
          vas = current_employee.visit_assignments.assigned
                                .joins(:visit).includes(visit: :service_user)
                                .where(visits: { status: :published,
                                                 scheduled_start: from.beginning_of_day..to.end_of_day })
                                .order("visits.scheduled_start")
          render json: vas.map { |va| VisitAssignmentSerializer.call(va, include_service_user: true) }
        end
      end
    end
  end
end
