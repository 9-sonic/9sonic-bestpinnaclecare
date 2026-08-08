module Api
  module V1
    module Admin
      # GET /api/v1/admin/me
      class MeController < BaseController
        include AvatarManagement

        def show
          render json: AdminSerializer.call(current_admin)
        end

        # PATCH /api/v1/admin/me — an admin edits their own profile. Personal
        # fields only; role and active stay a registered manager's job.
        def update
          current_admin.update!(params.permit(:first_name, :last_name, :phone))
          render json: AdminSerializer.call(current_admin)
        end

        # POST /api/v1/admin/me/avatar  (multipart: avatar)
        def avatar
          render json: AdminSerializer.call(current_admin) if attach_avatar_or_422(current_admin)
        end

        # DELETE /api/v1/admin/me/avatar
        def remove_avatar
          current_admin.avatar.purge_later
          render json: AdminSerializer.call(current_admin)
        end
      end
    end
  end
end
