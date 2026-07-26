module Api
  module V1
    module Admin
      class VisitAssignmentsController < BaseController
        # POST /api/v1/admin/visit_assignments  { visit_id, employee_id }
        # Runs soft validators (overlap / rest / weekly hours) and returns any
        # warnings alongside the created assignment — warnings never block.
        def create
          visit    = Visit.find(params.require(:visit_id))
          employee = Employee.find(params.require(:employee_id))
          warnings = Assignments::Validate.call(visit: visit, employee: employee)

          va = VisitAssignment.create!(visit: visit, employee: employee, assigned_by: current_admin)
          render json: VisitAssignmentSerializer.call(va).merge(warnings: warnings), status: :created
        end

        # DELETE /api/v1/admin/visit_assignments/:id  — withdraw (manual reassignment path)
        def destroy
          va = VisitAssignment.find(params[:id])
          va.update!(assignment_status: "withdrawn", lifecycle_state: :cancelled)
          head :no_content
        end
      end
    end
  end
end
