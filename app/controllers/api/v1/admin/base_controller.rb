module Api
  module V1
    module Admin
      # Base for office (Admin) endpoints — requires a valid Admin JWT.
      class BaseController < ApplicationController
        include RoleAuthorization

        before_action :authenticate_admin!

        DEFAULT_PER_PAGE = 25

        private

        def current_identity = current_admin

        # Shared list pagination for admin index actions. Reads ?page=&per_page=
        # (per_page clamped 1..100), counts the full scope, and returns the page's
        # rows through the block:
        #   { items:, page:, per_page:, total: }
        # Kept identical to the carer-profile/care-package shape already in use so
        # the frontend has one pagination contract to consume.
        def paginate(scope, per_page: DEFAULT_PER_PAGE)
          page  = [ params.fetch(:page, 1).to_i, 1 ].max
          per   = params.fetch(:per_page, per_page).to_i.clamp(1, 100)
          total = scope.count
          rows  = scope.offset((page - 1) * per).limit(per).map { |r| yield r }
          render json: { items: rows, page: page, per_page: per, total: total }
        end

        # Shared 422 for a double-booked carer (used by assign/reassign/cover).
        def render_conflict(clash)
          render json: {
            error: "carer_unavailable",
            conflict: {
              visit_id: clash.visit_id,
              service_user: clash.visit.service_user&.full_name,
              scheduled_start: clash.visit.scheduled_start&.iso8601,
              scheduled_end: clash.visit.scheduled_end&.iso8601
            }
          }, status: :unprocessable_entity
        end
      end
    end
  end
end
