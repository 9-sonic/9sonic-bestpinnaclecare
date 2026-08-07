module Api
  module V1
    module Admin
      # GET /api/v1/admin/reports?from=<iso>&to=<iso>
      #
      # Clocking performance over a date range, aggregated from existing records.
      # Defaults to the last 7 days.
      class ReportsController < BaseController
        def index
          to   = parse_time(params[:to]) || Time.current.end_of_day
          from = parse_time(params[:from]) || 7.days.ago.beginning_of_day
          render json: Reports::Build.call(from: from, to: to)
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
