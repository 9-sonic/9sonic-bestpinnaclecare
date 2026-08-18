module Api
  module V1
    module Admin
      # GET /api/v1/admin/audit — the append-only Event log, newest first.
      #
      # A read-only window on who did what, when and why: corrections, approvals,
      # assignments, setting changes, and client/staff record edits. Filterable by
      # event_type, aggregate_type, a specific record (aggregate_type +
      # aggregate_id), who did it (actor_type + actor_id), a date range
      # (from/to), and a `before` cursor for paging. Nothing here can be edited
      # or deleted.
      class AuditController < BaseController
        def index
          scope = Event.includes(:actor).order(occurred_at: :desc)
          scope = scope.where(event_type: params[:event_type]) if params[:event_type].present?
          scope = scope.where(aggregate_type: params[:aggregate_type]) if params[:aggregate_type].present?
          scope = scope.where(aggregate_id: params[:aggregate_id]) if params[:aggregate_id].present?
          scope = scope.where(actor_type: params[:actor_type]) if params[:actor_type].present?
          scope = scope.where(actor_id: params[:actor_id]) if params[:actor_id].present?
          if (from = parse_time(params[:from]))
            scope = scope.where("occurred_at >= ?", from)
          end
          if (to = parse_time(params[:to]))
            scope = scope.where("occurred_at <= ?", to)
          end
          if (before = parse_time(params[:before]))
            scope = scope.where("occurred_at < ?", before)
          end
          scope = scope.limit((params[:limit] || 50).to_i.clamp(1, 200))

          render json: scope.map { |e| EventSerializer.call(e) }
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
