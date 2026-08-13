module Api
  module V1
    module Admin
      class VisitAssignmentsController < BaseController
        # POST /api/v1/admin/visit_assignments  { visit_id, employee_id }
        # Hard-blocks a time-overlapping (double-booked) carer; returns the softer
        # rest/weekly-hours warnings alongside the created assignment.
        def create
          visit    = Visit.find(params.require(:visit_id))
          employee = Employee.find(params.require(:employee_id))
          return if double_booked?(visit, employee)

          warnings = Assignments::Validate.call(visit: visit, employee: employee)
          va = VisitAssignment.create!(visit: visit, employee: employee, assigned_by: current_admin)
          Events::Record.call(
            aggregate: va, actor: current_admin, event_type: "assignment.created",
            payload: { visit_id: visit.id, employee_id: employee.id, employee_name: employee.full_name }
          )
          render json: VisitAssignmentSerializer.call(va).merge(warnings: warnings), status: :created
        end

        # POST /api/v1/admin/visit_assignments/:id/reassign  { employee_id }
        # Atomically move a visit from its current carer to a new one: withdraw
        # the existing assignment and create the new one in a single transaction,
        # so the visit is never left unassigned and one coherent audit event is
        # written. Returns the new assignment plus soft warnings (overlap / rest /
        # weekly hours) — warnings never block, matching #create.
        def reassign
          current  = VisitAssignment.assigned.find(params[:id])
          employee = Employee.find(params.require(:employee_id))

          if employee.id == current.employee_id
            return render json: { error: "already_assigned" }, status: :unprocessable_entity
          end

          visit = current.visit
          return if double_booked?(visit, employee)

          warnings = Assignments::Validate.call(visit: visit, employee: employee)
          new_va   = nil

          ActiveRecord::Base.transaction do
            current.update!(assignment_status: "withdrawn", lifecycle_state: :cancelled)
            new_va = VisitAssignment.create!(visit: visit, employee: employee, assigned_by: current_admin)
            Events::Record.call(
              aggregate: new_va, actor: current_admin, event_type: "assignment.reassigned",
              payload: {
                visit_id: visit.id,
                from_employee_id: current.employee_id, from_employee_name: current.employee.full_name,
                to_employee_id: employee.id, to_employee_name: employee.full_name
              }
            )
          end

          render json: VisitAssignmentSerializer.call(new_va).merge(warnings: warnings), status: :created
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

        private

        # Refuse to put a carer on a visit that overlaps one they're already on —
        # a carer can't be in two homes at once. Renders 422 with the clashing
        # visit and returns true when blocked. NOTE: this hard-blocks double-ups
        # (two overlapping visits for one carer) as policy; confirm with Best
        # Pinnacle (via Jesse) whether any legitimate double-up should be allowed.
        def double_booked?(visit, employee)
          clash = Assignments::Validate.conflicting_visit(visit: visit, employee: employee)
          return false unless clash

          render json: {
            error: "carer_unavailable",
            conflict: {
              visit_id: clash.visit_id,
              service_user: clash.visit.service_user&.full_name,
              scheduled_start: clash.visit.scheduled_start&.iso8601,
              scheduled_end: clash.visit.scheduled_end&.iso8601
            }
          }, status: :unprocessable_entity
          true
        end
      end
    end
  end
end
