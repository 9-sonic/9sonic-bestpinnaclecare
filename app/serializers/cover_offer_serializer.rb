class CoverOfferSerializer
  def self.call(o)
    {
      id:            o.id,
      visit_id:      o.visit_id,
      employee_id:   o.employee_id,
      employee_name: o.employee&.full_name,
      state:         o.state,
      note:          o.note,
      offered_at:    o.offered_at&.iso8601,
      responded_at:  o.responded_at&.iso8601
    }
  end
end
