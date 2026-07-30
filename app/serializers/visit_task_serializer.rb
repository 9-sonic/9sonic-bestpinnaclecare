class VisitTaskSerializer
  def self.call(t)
    {
      id: t.id, label: t.label, done: t.done,
      care_plan_item_id: t.care_plan_item_id, completed_at: t.completed_at&.iso8601
    }
  end
end
