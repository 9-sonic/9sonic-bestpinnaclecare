class MileageClaimSerializer
  def self.call(m)
    {
      id: m.id, employee_id: m.employee_id, visit_assignment_id: m.visit_assignment_id,
      travel_date: m.travel_date, miles: m.miles&.to_f, from_label: m.from_label, to_label: m.to_label,
      source: m.source, state: m.state
    }
  end
end
