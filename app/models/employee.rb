# The carers. Authenticates at /api/v1/staff/auth/login (employees table only).
class Employee < ApplicationRecord
  include Authenticatable

  enum :role, { carer: "carer" }

  has_many :visit_assignments, dependent: :restrict_with_error
  has_many :visits, through: :visit_assignments
  has_many :employee_availabilities, dependent: :destroy
  has_many :carer_requests, dependent: :destroy
  has_many :mileage_claims, dependent: :restrict_with_error
end
