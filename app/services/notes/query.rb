module Notes
  # The one place that decides *which* visit notes a filtered request returns.
  # The on-screen list, the PDF export and the DOCX export all go through here so
  # they can never drift apart — what you see is exactly what you export.
  #
  # Notes are the carer's write-up for a visit (VisitNote, append-only). We only
  # ever surface the *effective* note in each correction chain, never a
  # superseded draft. Through visit_assignment -> visit a note has both a client
  # (service_user) and a carer (the assignment's employee); the author is who
  # actually wrote it (Employee or, for an office edit, Admin).
  #
  # Filters (all optional, all AND-ed):
  #   employee_id      — the carer who ATTENDED the visit (assignment.employee)
  #   service_user_id  — the client the visit was for
  #   from / to        — inclusive date range on the visit's scheduled start
  #   q                — free text, matched against the note body
  class Query
    # Build the filtered ActiveRecord scope, newest note first.
    def self.scope(employee_id: nil, service_user_id: nil, from: nil, to: nil, q: nil)
      # `author` is polymorphic (Employee | Admin) — it must be `preload`ed, not
      # `includes`d, or AR raises EagerLoadPolymorphicError as soon as a filter
      # forces a reference join. The visit/service_user/employee chain is a plain
      # belongs_to and preloads fine too, so preload the lot and keep the join
      # (for the WHERE/ORDER) separate from how associations are loaded.
      # Newest visit first — this is a journal read over time, so it orders by
      # when the visit happened, not when the note row was written (an office
      # correction is written later but belongs on its visit's date). created_at
      # breaks ties so the order is stable.
      rel = VisitNote.effective
                     .joins(visit_assignment: :visit)
                     .preload(:author, visit_assignment: { visit: :service_user, employee: {} })
                     .order("visits.scheduled_start DESC, visit_notes.created_at DESC")

      rel = rel.where(visit_assignments: { employee_id: employee_id }) if employee_id.present?
      rel = rel.where(visits: { service_user_id: service_user_id }) if service_user_id.present?
      rel = rel.where("visits.scheduled_start >= ?", from.beginning_of_day) if from
      rel = rel.where("visits.scheduled_start <= ?", to.end_of_day) if to
      if q.present?
        rel = rel.where("visit_notes.body ILIKE ?", "%#{ActiveRecord::Base.sanitize_sql_like(q)}%")
      end
      rel
    end

    # Flatten a note into the shape the page and exporters both consume, so the
    # client name, carer name and visit date are resolved in exactly one place.
    def self.row(note)
      va    = note.visit_assignment
      visit = va.visit
      VisitNoteSerializer.call(note).merge(
        visit_id: va.visit_id,
        visit_scheduled_start: visit.scheduled_start&.iso8601,
        service_user_id: visit.service_user_id,
        service_user_name: visit.service_user&.full_name,
        employee_id: va.employee_id,
        employee_name: va.employee&.full_name
      )
    end
  end
end
