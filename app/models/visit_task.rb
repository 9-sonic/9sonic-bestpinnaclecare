# A checklist item on a specific visit (what the carer did).
class VisitTask < ApplicationRecord
  belongs_to :visit_assignment
  belongs_to :care_plan_item, optional: true
end
