module Api
  module V1
    module Admin
      class AdminsController < BaseController
        # Managing office users is the registered manager's job.
        before_action -> { authorize_role!(:registered_manager) }, except: :index

        def index
          paginate(::Admin.order(:last_name, :first_name)) { |a| AdminSerializer.call(a) }
        end

        def show
          render json: AdminSerializer.call(::Admin.find(params[:id]))
        end

        # POST /api/v1/admin/admins — invite an office user
        def create
          admin = Authentication::InviteAdmin.call(attrs: admin_params, invited_by: current_admin)
          render json: AdminSerializer.call(admin), status: :created
        end

        def update
          admin = ::Admin.find(params[:id])
          if (err = lockout_error(admin, admin_params))
            return render json: { error: err }, status: :unprocessable_entity
          end

          admin.update!(admin_params)
          render json: AdminSerializer.call(admin)
        end

        private

        # Guards against locking the system out of administration:
        #  - you can't deactivate/demote yourself,
        #  - you can't remove the last active registered_manager.
        def lockout_error(admin, attrs)
          deactivating = attrs.key?(:active) && ActiveModel::Type::Boolean.new.cast(attrs[:active]) == false
          demoting     = attrs.key?(:role) && attrs[:role].to_s != "registered_manager"

          return "cannot_deactivate_self" if admin.id == current_admin.id && deactivating
          return nil unless admin.registered_manager? && (deactivating || demoting)

          others = ::Admin.where(role: "registered_manager", active: true).where.not(id: admin.id).exists?
          "last_registered_manager" unless others
        end

        def admin_params
          params.permit(:email, :first_name, :last_name, :phone, :role, :active)
        end
      end
    end
  end
end
