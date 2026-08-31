module Api
  module V1
    module Admin
      class VisitAssignmentsController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) }, only: %i[create reassign destroy]
        # POST /api/v1/admin/visit_assignments  { visit_id, employee_id }
        # Hard-blocks a time-overlapping (double-booked) carer; returns the softer
        # rest/weekly-hours warnings alongside the created assignment.
        def create
          visit    = Visit.find(params.require(:visit_id))
          employee = Employee.find(params.require(:employee_id))

          result = Assignments::Assign.call(visit: visit, employee: employee, assigned_by: current_admin)
          return render_conflict(result.conflict, result.reason) unless result.ok

          va = result.assignment
          Events::Record.call(
            aggregate: va, actor: current_admin, event_type: "assignment.created",
            payload: { visit_id: visit.id, employee_id: employee.id, employee_name: employee.full_name }
          )
          # If the visit is already published, there's no later publish to carry
          # the news — tell the carer now. (Draft assignments are announced at
          # publish, so ShiftAssigned no-ops for a draft.)
          Notifications::ShiftAssigned.call(visit: visit, employee: employee)
          # Live-refresh the carer's PWA calendar regardless of draft/published.
          Notifications::ShiftChanged.call(employee)
          warnings = Assignments::Validate.call(visit: visit, employee: employee)
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

          # Race-safe withdraw-old + assign-new in one locked transaction.
          result = Assignments::Assign.call(visit: visit, employee: employee, assigned_by: current_admin, withdraw: current)
          return render_conflict(result.conflict, result.reason) unless result.ok

          new_va = result.assignment
          Events::Record.call(
            aggregate: new_va, actor: current_admin, event_type: "assignment.reassigned",
            payload: {
              visit_id: visit.id,
              from_employee_id: current.employee_id, from_employee_name: current.employee.full_name,
              to_employee_id: employee.id, to_employee_name: employee.full_name
            }
          )
          # The new carer inherits a published visit with no later publish to
          # announce it — tell them now (no-ops if the visit is still a draft).
          Notifications::ShiftAssigned.call(visit: visit, employee: employee)
          # Both calendars change: the old carer loses the shift, the new one gains it.
          Notifications::ShiftChanged.call([ current.employee, employee ])
          warnings = Assignments::Validate.call(visit: visit, employee: employee)

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
          # The carer just lost this shift — refresh their calendar so it drops off.
          Notifications::ShiftChanged.call(va.employee)
          head :no_content
        end
      end
    end
  end
end
