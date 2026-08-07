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
          Events::Record.call(
            aggregate: va, actor: current_admin, event_type: "assignment.created",
            payload: { visit_id: visit.id, employee_id: employee.id, employee_name: employee.full_name }
          )
          render json: VisitAssignmentSerializer.call(va).merge(warnings: warnings), status: :created
        end

        # DELETE /api/v1/admin/visit_assignments/:id  — withdraw (manual reassignment path)
        def destroy
          va = VisitAssignment.find(params[:id])
          va.update!(assignment_status: "withdrawn", lifecycle_state: :cancelled)
          Events::Record.call(
            aggregate: va, actor: current_admin, event_type: "assignment.withdrawn",
            payload: { visit_id: va.visit_id, employee_id: va.employee_id }
          )
          head :no_content
        end
      end
    end
  end
end
