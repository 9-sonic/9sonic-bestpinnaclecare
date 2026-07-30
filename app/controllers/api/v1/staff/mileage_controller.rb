module Api
  module V1
    module Staff
      class MileageController < BaseController
        # GET /api/v1/staff/mileage?from=&to=
        def index
          claims = current_employee.mileage_claims.order(travel_date: :desc)
          from = parse_date(params[:from])
          to   = parse_date(params[:to])
          claims = claims.where(travel_date: from..to) if from && to
          render json: claims.map { |m| MileageClaimSerializer.call(m) }
        end

        # POST /api/v1/staff/mileage { visit_assignment_id?, travel_date, miles, from_label?, to_label? }
        def create
          attrs = mileage_params
          if attrs[:visit_assignment_id].present? &&
             !current_employee.visit_assignments.exists?(id: attrs[:visit_assignment_id])
            return render json: { error: "invalid_visit_assignment" }, status: 422
          end

          claim = current_employee.mileage_claims.create!(attrs.merge(source: "carer", state: "claimed"))
          render json: MileageClaimSerializer.call(claim), status: :created
        end

        private

        def mileage_params
          params.permit(:visit_assignment_id, :travel_date, :miles, :from_label, :to_label)
        end

        def parse_date(str)
          Date.parse(str) if str.present?
        rescue ArgumentError, TypeError
          nil
        end
      end
    end
  end
end
