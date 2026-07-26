module Api
  module V1
    module Admin
      class ServiceUsersController < BaseController
        def index
          render json: ServiceUser.order(:last_name, :first_name).map { |su| ServiceUserSerializer.call(su) }
        end

        def show
          render json: ServiceUserSerializer.call(ServiceUser.find(params[:id]))
        end

        def create
          su = ServiceUser.create!(service_user_params)
          render json: ServiceUserSerializer.call(su), status: :created
        end

        def update
          su = ServiceUser.find(params[:id])
          su.update!(service_user_params)
          render json: ServiceUserSerializer.call(su)
        end

        private

        def service_user_params
          params.permit(:first_name, :last_name, :reference, :date_of_birth, :phone,
                        :address_line1, :address_line2, :city, :postcode,
                        :lat, :lng, :geofence_radius_m, :geofence_mode, :access_notes, :active)
        end
      end
    end
  end
end
