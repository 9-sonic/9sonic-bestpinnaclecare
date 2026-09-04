module Cover
  # Broadcast an unfilled visit to every eligible carer at once (first-come cover).
  # Creates a pending CoverOffer per carer and notifies them; the first to accept
  # fills the visit (the accept path locks the visit and re-checks staffing), and
  # the losers see it's already taken.
  #
  # Eligibility (smallest reversible default — confirm with Best Pinnacle via
  # Jesse before treating as signed off): any ACTIVE carer who isn't already
  # assigned to this visit and doesn't have a clashing visit. No skills/area gate
  # yet — that's a policy the client hasn't defined.
  #
  # Idempotent: re-broadcasting reuses existing pending offers (unique index on
  # visit+employee), so it can be called again to reach carers added since.
  class Broadcast
    Result = Struct.new(:ok, :offers, :error, keyword_init: true)

    def self.call(visit:, actor:, note: nil) = new(visit, actor, note).call

    def initialize(visit, actor, note)
      @visit = visit
      @actor = actor
      @note  = note
    end

    def call
      return Result.new(ok: false, error: "visit_already_filled") if filled?

      offers = []
      CoverOffer.transaction do
        eligible_carers.each do |carer|
          offer = CoverOffer.find_or_create_by!(visit: @visit, employee: carer) do |o|
            o.offered_by = @actor
            o.note = @note
            o.state = "pending"
          end
          # A previously declined/withdrawn offer is re-opened on a fresh broadcast.
          offer.update!(state: "pending", note: @note, responded_at: nil) unless offer.state == "pending"
          offers << offer
        end
      end

      notify(offers.map(&:employee))
      Events::Record.call(
        aggregate: @visit, actor: @actor, event_type: "cover.broadcast",
        payload: { offer_count: offers.size }
      )
      Result.new(ok: true, offers: offers)
    end

    private

    def filled?
      @visit.visit_assignments.count { |a| a.assignment_status == "assigned" && a.lifecycle_state != "cancelled" } >= @visit.staff_required
    end

    # Every active carer not already on this visit. A carer's own overlapping
    # work is no longer a reason to withhold the offer — carers may double up.
    def eligible_carers
      already = @visit.visit_assignments.where(assignment_status: "assigned").pluck(:employee_id)
      Employee.where(active: true).where.not(id: already).to_a
    end

    def notify(carers)
      return if carers.empty?

      su = @visit.service_user
      Notifications::Deliver.call(
        recipients: carers, category: "cover", kind: "cover_offer",
        title: "Cover needed",
        body: "#{su&.full_name} · #{@visit.scheduled_start&.strftime('%a %-d %b, %H:%M')}",
        subject: @visit, channels: %w[in_app push]
      )
    end
  end
end
