class CarePlanItemSerializer
  def self.call(c)
    { id: c.id, category: c.category, label: c.label, detail: c.detail, position: c.position, active: c.active }
  end
end
