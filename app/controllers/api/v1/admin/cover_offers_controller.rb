module Api
  module V1
    module Admin
      # Offer an unfilled visit to a carer; accepting fills it and creates the
      # assignment. Every step lands in the audit trail.
      #
      # Policy defaults (smallest reversible — confirm with Best Pinnacle via
      # Jesse before treating as signed off): any active carer may be offered a
      # shift, and offers do not auto-expire. There is no eligibility gate here.
      class CoverOffersController < BaseController
        before_action -> { authorize_role!(:registered_manager, :manager, :coordinator) }, only: %i[create accept decline]
        def create
          visit    = Visit.find(params.require(:visit_id))
          employee = Employee.find(params.require(:employee_id))

          offer = CoverOffer.create!(visit: visit, employee: employee, offered_by: current_admin,
                                     note: params[:note], state: "pending")

          Events::Record.call(
            aggregate: visit, actor: current_admin, event_type: "cover.offered",
            payload: { employee_id: employee.id, employee_name: employee.full_name }
          )
          render json: CoverOfferSerializer.call(offer), status: :created
        end

        def accept
          offer = CoverOffer.find(params[:id])
          va = nil
          result = nil

          # Lock the visit so two concurrent accepts can't both fill it (the
          # fill race), then re-check it still needs staffing. The carer double-
          # book is handled race-safely inside Assignments::Assign.
          ApplicationRecord.transaction do
            visit = Visit.lock.find(offer.visit_id)
            filled = visit.visit_assignments.assigned.count
            if filled >= visit.staff_required
              result = :already_filled
              next
            end

            result = Assignments::Assign.call(visit: visit, employee: offer.employee, assigned_by: current_admin)
            next unless result.ok

            va = result.assignment
            offer.update!(state: "accepted", responded_at: Time.current)
            Events::Record.call(
              aggregate: visit, actor: current_admin, event_type: "cover.accepted",
              payload: { employee_id: offer.employee_id, employee_name: offer.employee.full_name }
            )
            Events::Record.call(
              aggregate: va, actor: current_admin, event_type: "assignment.created",
              payload: { visit_id: offer.visit_id, employee_id: offer.employee_id, employee_name: offer.employee.full_name }
            )
          end

          return render json: { error: "visit_already_filled" }, status: :unprocessable_entity if result == :already_filled
          return render_conflict(result.conflict) unless result.ok

          render json: { offer: CoverOfferSerializer.call(offer), assignment: VisitAssignmentSerializer.call(va) }
        end

        def decline
          offer = CoverOffer.find(params[:id])
          offer.update!(state: "declined", responded_at: Time.current)

          Events::Record.call(
            aggregate: offer.visit, actor: current_admin, event_type: "cover.declined",
            payload: { employee_id: offer.employee_id }
          )
          render json: CoverOfferSerializer.call(offer)
        end
      end
    end
  end
end
