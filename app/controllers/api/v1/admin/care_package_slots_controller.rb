module Api
  module V1
    module Admin
      class CarePackageSlotsController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) }, only: %i[create update]
        # GET /admin/care_package_slots?service_user_id=&page=&per_page=
        # Paginated so the list stays bounded as clients × slots grows. When
        # scoped to a single client (service_user_id) the set is small.
        def index
          scope = params[:service_user_id] ? CarePackageSlot.where(service_user_id: params[:service_user_id]) : CarePackageSlot.all
          scope = scope.order(:start_time)

          page     = [ params.fetch(:page, 1).to_i, 1 ].max
          per_page = params.fetch(:per_page, 50).to_i.clamp(1, 100)
          total    = scope.count
          items    = scope.offset((page - 1) * per_page).limit(per_page).map { |s| CarePackageSlotSerializer.call(s) }
          render json: { items: items, page: page, per_page: per_page, total: total }
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
