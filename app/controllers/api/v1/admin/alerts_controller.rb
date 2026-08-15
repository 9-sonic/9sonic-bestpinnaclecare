module Api
  module V1
    module Admin
      class AlertsController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) }, only: %i[acknowledge resolve]
        # The inbox: everything not yet resolved, plus anything resolved today so
        # the "resolved" count and filter have something to show.
        def index
          scope = Alert.where("state <> 'resolved' OR resolved_at >= ?", Time.current.beginning_of_day)
          paginate(scope.order(raised_at: :desc)) { |a| AlertSerializer.call(a) }
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
