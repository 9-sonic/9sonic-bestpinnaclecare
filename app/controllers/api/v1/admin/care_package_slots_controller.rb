module Api
  module V1
    module Admin
      class CarePackageSlotsController < BaseController
        def index
          scope = params[:service_user_id] ? CarePackageSlot.where(service_user_id: params[:service_user_id]) : CarePackageSlot.all
          render json: scope.order(:start_time).map { |s| CarePackageSlotSerializer.call(s) }
        end

        def create
          slot = CarePackageSlot.create!(slot_params)
          render json: CarePackageSlotSerializer.call(slot), status: :created
        end

        def update
          slot = CarePackageSlot.find(params[:id])
          slot.update!(slot_params)
          render json: CarePackageSlotSerializer.call(slot)
        end

        private

        def slot_params
          params.permit(:service_user_id, :name, :start_time, :end_time, :recurrence,
                        :staff_required, :break_minutes, :effective_from, :effective_to, :active)
        end
      end
    end
  end
end
