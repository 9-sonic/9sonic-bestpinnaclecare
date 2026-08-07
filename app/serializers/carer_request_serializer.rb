class CarerRequestSerializer
  def self.call(r)
    {
      id:            r.id,
      employee_id:   r.employee_id,
      employee_name: r.employee&.full_name,
      kind:          r.kind,
      state:         r.state,
      summary:       r.summary,
      detail:        r.detail,
      payload:       r.payload,
      decided_by:    r.decided_by&.full_name,
      decision_note: r.decision_note,
      decided_at:    r.decided_at&.iso8601,
      created_at:    r.created_at&.iso8601
    }
  end
end
