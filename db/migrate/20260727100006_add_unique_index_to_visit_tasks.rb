class AddUniqueIndexToVisitTasks < ActiveRecord::Migration[8.1]
  def change
    # One task per care-plan item per visit — makes lazy task seeding safe under
    # concurrent first-views of the visit detail.
    add_index :visit_tasks, %i[visit_assignment_id care_plan_item_id], unique: true,
              where: "care_plan_item_id IS NOT NULL", name: "idx_visit_tasks_unique_care_plan"
  end
end
