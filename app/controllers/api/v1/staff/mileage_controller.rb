module Api
  module V1
    module Staff
      class MileageController < BaseController
        # GET /api/v1/staff/mileage?from=&to=
        def index
          claims = current_employee.mileage_claims.order(travel_date: :desc)
          if params[:from].present? && params[:to].present?
            claims = claims.where(travel_date: Date.parse(params[:from])..Date.parse(params[:to]))
          end
          render json: claims.map { |m| MileageClaimSerializer.call(m) }
        end

        # POST /api/v1/staff/mileage { visit_assignment_id?, travel_date, miles, from_label?, to_label? }
        def create
          claim = current_employee.mileage_claims.create!(mileage_params.merge(source: "carer", state: "claimed"))
          render json: MileageClaimSerializer.call(claim), status: :created
        end

        private

        def mileage_params
          params.permit(:visit_assignment_id, :travel_date, :miles, :from_label, :to_label)
        end
      end
    end
  end
end
