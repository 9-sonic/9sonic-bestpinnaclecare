module Api
  module V1
    module Admin
      # Care plan for a service user (nested under /admin/service_users/:id).
      class CarePlanItemsController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) }, only: %i[create update destroy]

        def index
          render json: service_user.care_plan_items.map { |c| CarePlanItemSerializer.call(c) }
        end

        def create
          item = service_user.care_plan_items.create!(item_params)
          render json: CarePlanItemSerializer.call(item), status: :created
        end

        def update
          item = service_user.care_plan_items.find(params[:id])
          item.update!(item_params)
          render json: CarePlanItemSerializer.call(item)
        end

        def destroy
          service_user.care_plan_items.find(params[:id]).update!(active: false) # soft delete
          head :no_content
        end

        private

        def service_user = ServiceUser.find(params[:service_user_id])
        def item_params  = params.permit(:category, :label, :detail, :position, :active)
      end
    end
  end
end
