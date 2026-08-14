module Api
  module V1
    module Admin
      # Base for office (Admin) endpoints — requires a valid Admin JWT.
      class BaseController < ApplicationController
        include RoleAuthorization

        before_action :authenticate_admin!

        private

        def current_identity = current_admin

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
