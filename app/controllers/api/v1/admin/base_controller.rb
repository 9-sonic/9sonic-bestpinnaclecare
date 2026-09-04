module Api
  module V1
    module Admin
      # Base for office (Admin) endpoints — requires a valid Admin JWT.
      class BaseController < ApplicationController
        include RoleAuthorization

        before_action :authenticate_admin!

        DEFAULT_PER_PAGE = 25
        # Full-list views (the rota, admin/service-user pickers) ask for everything
        # in one page via per_page=500. The ceiling must clear a real week of the
        # rota — 180+ visits once the weekly template is generated — or the tail of
        # the week (Fri–Sun, sorted last by start time) is silently dropped.
        MAX_PER_PAGE = 500

        private

        def current_identity = current_admin

        # Shared list pagination for admin index actions. Reads ?page=&per_page=
        # (per_page clamped 1..MAX_PER_PAGE), counts the full scope, and returns the
        # page's rows through the block:
        #   { items:, page:, per_page:, total: }
        # Kept identical to the carer-profile/care-package shape already in use so
        # the frontend has one pagination contract to consume.
        def paginate(scope, per_page: DEFAULT_PER_PAGE)
          page  = [ params.fetch(:page, 1).to_i, 1 ].max
          per   = params.fetch(:per_page, per_page).to_i.clamp(1, MAX_PER_PAGE)
          total = scope.count
          rows  = scope.offset((page - 1) * per).limit(per).map { |r| yield r }
          render json: { items: rows, page: page, per_page: per, total: total }
        end

        # Shared 422 for an assignment conflict (used by assign/reassign/cover).
        # reason: :carer -> the carer is already booked in an overlapping visit.
        # reason: :client -> the client already has a carer then (one service
        # user, one carer at a time).
        def render_conflict(clash, reason = :carer)
          # :duplicate has no clashing visit — the carer is already on THIS visit.
          # 409 Conflict, matching the RecordNotUnique the DB index used to raise
          # before this pre-check existed (error_handling rescues it to :conflict).
          if reason == :duplicate
            return render json: { error: "already_on_visit" }, status: :conflict
          end

          # :client is the only conflict left — a carer overlapping themselves is
          # allowed (carers may double up across clients, with no limit).
          render json: {
            error: "client_unavailable",
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
