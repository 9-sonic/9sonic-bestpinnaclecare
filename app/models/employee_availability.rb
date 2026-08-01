# A carer's standing weekly availability (optionally date-bounded).
class EmployeeAvailability < ApplicationRecord
  belongs_to :employee

  enum :slot, { morning: "morning", afternoon: "afternoon", evening: "evening", night: "night" }
end
