module Api
  module V1
    module Admin
      class AlertsController < BaseController
        def index
          render json: Alert.where(state: :open).order(raised_at: :desc).map { |a| AlertSerializer.call(a) }
        end

        # POST /api/v1/admin/alerts/:id/acknowledge
        def acknowledge
          alert = Alert.find(params[:id])
          alert.update!(state: :acknowledged, acknowledged_by: current_admin, acknowledged_at: Time.current)
          render json: AlertSerializer.call(alert)
        end

        # POST /api/v1/admin/alerts/:id/resolve
        def resolve
          alert = Alert.find(params[:id])
          alert.update!(state: :resolved, resolved_at: Time.current, resolution_note: params[:resolution_note])
          render json: AlertSerializer.call(alert)
        end
      end
    end
  end
end
