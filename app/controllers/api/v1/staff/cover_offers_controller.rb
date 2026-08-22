module Api
  module V1
    module Staff
      # A carer's view of cover offers made to them, and accepting/declining in
      # the app. Accepting fills the visit — first come, first served — using the
      # same visit lock + conflict guard as the office-side accept, so two carers
      # racing for the same visit can't both win or double-book.
      class CoverOffersController < BaseController
        # GET /api/v1/staff/cover_offers
        # The carer's own open (pending) offers, soonest visit first. Only offers
        # for visits that still need staffing are shown — once filled, it's gone.
        def index
          offers = CoverOffer.where(employee: current_employee, state: "pending")
                             .includes(visit: :service_user)
                             .order("visits.scheduled_start ASC")
                             .select { |o| still_open?(o.visit) }
          render json: offers.map { |o| serialize(o) }
        end

        # POST /api/v1/staff/cover_offers/:id/accept
        def accept
          offer = current_employee.cover_offers.find(params[:id])
          return render(json: { error: "offer_closed" }, status: :unprocessable_entity) unless offer.state == "pending"

          clash = Assignments::Validate.conflicting_visit(visit: offer.visit, employee: current_employee)
          if clash
            return render(json: {
              error: "carer_unavailable",
              conflict: {
                visit_id: clash.visit_id,
                service_user: clash.visit.service_user&.full_name,
                scheduled_start: clash.visit.scheduled_start&.iso8601,
                scheduled_end: clash.visit.scheduled_end&.iso8601
              }
            }, status: :unprocessable_entity)
          end

          va = nil
          result = nil
          ApplicationRecord.transaction do
            # Lock the visit so two concurrent accepts can't both fill it.
            visit = Visit.lock.find(offer.visit_id)
            if visit.visit_assignments.assigned.count >= visit.staff_required
              result = :already_filled
              next
            end

            result = Assignments::Assign.call(visit: visit, employee: current_employee, assigned_by: nil)
            next unless result.ok

            va = result.assignment
            offer.update!(state: "accepted", responded_at: Time.current)
            # The visit is now filled — retire the sibling broadcast offers so the
            # other carers see it's gone rather than racing a lost cause.
            CoverOffer.where(visit_id: visit.id, state: "pending").where.not(id: offer.id)
                      .update_all(state: "withdrawn", responded_at: Time.current, updated_at: Time.current)

            Events::Record.call(aggregate: visit, actor: current_employee, event_type: "cover.accepted",
                                payload: { employee_id: current_employee.id, employee_name: current_employee.full_name, via: "carer" })
            Events::Record.call(aggregate: va, actor: current_employee, event_type: "assignment.created",
                                payload: { visit_id: visit.id, employee_id: current_employee.id, via: "cover" })
          end

          return render(json: { error: "visit_already_filled" }, status: :unprocessable_entity) if result == :already_filled
          return render(json: { error: result.reason || "could_not_assign" }, status: :unprocessable_entity) unless result.ok

          render json: { offer: serialize(offer.reload), assignment: VisitAssignmentSerializer.call(va) }
        end

        # POST /api/v1/staff/cover_offers/:id/decline
        def decline
          offer = current_employee.cover_offers.find(params[:id])
          offer.update!(state: "declined", responded_at: Time.current) if offer.state == "pending"
          Events::Record.call(aggregate: offer.visit, actor: current_employee, event_type: "cover.declined",
                              payload: { employee_id: current_employee.id, via: "carer" })
          render json: serialize(offer)
        end

        private

        def still_open?(visit)
          visit.visit_assignments.count { |a| a.assignment_status == "assigned" && a.lifecycle_state != "cancelled" } < visit.staff_required
        end

        # Offer + the visit detail a carer needs to decide (client, time, address).
        def serialize(offer)
          v  = offer.visit
          su = v.service_user
          {
            id:              offer.id,
            state:           offer.state,
            note:            offer.note,
            offered_at:      offer.offered_at&.iso8601,
            responded_at:    offer.responded_at&.iso8601,
            visit: {
              id:              v.id,
              client:          su&.full_name,
              address:         [ su&.address_line1, su&.postcode ].compact_blank.join(", "),
              scheduled_start: v.scheduled_start&.iso8601,
              scheduled_end:   v.scheduled_end&.iso8601,
              hours:           v.scheduled_end && v.scheduled_start ? ((v.scheduled_end - v.scheduled_start) / 3600.0).round(2) : nil
            }
          }
        end
      end
    end
  end
end
