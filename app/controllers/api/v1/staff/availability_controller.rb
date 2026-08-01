module Api
  module V1
    module Staff
      # GET/PUT /api/v1/staff/availability — the carer's standing weekly pattern.
      class AvailabilityController < BaseController
        def show
          render json: serialize(current_employee.employee_availabilities.order(:weekday, :slot))
        end

        # PUT { entries: [ { weekday, slot, available, effective_from?, effective_to? } ] }
        def update
          entries = params.permit(entries: %i[weekday slot available effective_from effective_to])[:entries] || []
          ActiveRecord::Base.transaction do
            entries.each do |e|
              rec = current_employee.employee_availabilities.find_or_initialize_by(weekday: e[:weekday], slot: e[:slot])
              rec.update!(available: e.fetch(:available, true), effective_from: e[:effective_from], effective_to: e[:effective_to])
            end
          end
          render json: serialize(current_employee.employee_availabilities.order(:weekday, :slot))
        end

        private

        def serialize(scope) = scope.map { |a| EmployeeAvailabilitySerializer.call(a) }
      end
    end
  end
end
