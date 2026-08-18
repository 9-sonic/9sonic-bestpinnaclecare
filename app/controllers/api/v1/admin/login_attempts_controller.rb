module Api
  module V1
    module Admin
      # GET /api/v1/admin/login_attempts — every sign-in try, success or
      # failure, newest first. Separate from /admin/audit because a login
      # attempt is not an Event (a failed attempt against an unknown email has
      # no record to attach to — see LoginAttempt).
      #
      # Filterable by resource_type/resource_id (a specific admin or carer),
      # success, and a date range (from/to).
      class LoginAttemptsController < BaseController
        def index
          scope = LoginAttempt.includes(:resource).recent_first
          scope = scope.where(resource_type: params[:resource_type]) if params[:resource_type].present?
          scope = scope.where(resource_id: params[:resource_id]) if params[:resource_id].present?
          scope = scope.where(success: ActiveModel::Type::Boolean.new.cast(params[:success])) if params[:success].present?
          if (from = parse_time(params[:from]))
            scope = scope.where("occurred_at >= ?", from)
          end
          if (to = parse_time(params[:to]))
            scope = scope.where("occurred_at <= ?", to)
          end
          scope = scope.limit((params[:limit] || 50).to_i.clamp(1, 200))

          render json: scope.map { |la| LoginAttemptSerializer.call(la) }
        end

        private

        def parse_time(str)
          Time.zone.parse(str) if str.present?
        rescue ArgumentError, TypeError
          nil
        end
      end
    end
  end
end
