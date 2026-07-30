# Travel between visits. source: carer-claimed or rota-calculated.
class MileageClaim < ApplicationRecord
  belongs_to :employee
  belongs_to :visit_assignment, optional: true
end
