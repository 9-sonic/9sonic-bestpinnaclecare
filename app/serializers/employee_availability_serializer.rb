class EmployeeAvailabilitySerializer
  def self.call(a)
    {
      id: a.id, weekday: a.weekday, slot: a.slot, available: a.available,
      effective_from: a.effective_from, effective_to: a.effective_to
    }
  end
end
