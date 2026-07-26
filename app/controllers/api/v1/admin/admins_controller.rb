module Api
  module V1
    module Admin
      class AdminsController < BaseController
        # Managing office users is the registered manager's job.
        before_action -> { authorize_role!(:registered_manager) }, except: :index

        def index
          render json: ::Admin.order(:last_name, :first_name).map { |a| AdminSerializer.call(a) }
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
          admin.update!(admin_params)
          render json: AdminSerializer.call(admin)
        end

        private

        def admin_params
          params.permit(:email, :first_name, :last_name, :phone, :role, :active)
        end
      end
    end
  end
end
