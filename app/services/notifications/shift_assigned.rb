module Notifications
  # Tell a carer about a shift that's now really theirs — a published visit they
  # are assigned to. This is the carer's "you're on for this" alert; without it a
  # carer only learns of a new shift by opening the app and reading their rota,
  # which for an offline-first care app means real shifts get missed.
  #
  # Only fires for PUBLISHED visits: a draft rota is edited and reassigned freely
  # before it goes live, so notifying on every draft assignment would spam carers
  # with shifts that then change. Call it:
  #   • at publish, for each assigned carer (a draft becoming real), and
  #   • when a carer is assigned/reassigned onto an ALREADY-published visit
  #     (there's no later publish to carry the news).
  #
  # Goes to the bell + web push, honouring the carer's notification preferences,
  # like every other carer-facing notification.
  class ShiftAssigned
    def self.call(visit:, employee: nil)
      return unless visit&.published?

      carers = if employee
        [ employee ]
      else
        visit.visit_assignments.assigned.filter_map(&:employee)
      end
      return if carers.empty?

      su = visit.service_user
      when_str = visit.scheduled_start&.strftime("%a %-d %b, %H:%M")
      Notifications::Deliver.call(
        recipients: carers,
        category: "shift",
        kind: "shift_assigned",
        title: "New shift",
        body: [ su&.full_name, when_str ].compact.join(" · "),
        subject: visit,
        channels: %w[in_app push]
      )
    end
  end
end
