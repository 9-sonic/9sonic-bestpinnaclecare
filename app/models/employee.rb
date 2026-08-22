# The carers. Authenticates at /api/v1/staff/auth/login (employees table only).
class Employee < ApplicationRecord
  include Authenticatable

  enum :role, { carer: "carer" }

  has_many :visit_assignments, dependent: :restrict_with_error
  has_many :visits, through: :visit_assignments
  has_many :employee_availabilities, dependent: :destroy
  has_many :carer_requests, dependent: :destroy
  has_many :cover_offers, dependent: :destroy
  has_many :mileage_claims, dependent: :restrict_with_error

  # Give every carer a stable staff reference when one isn't supplied — EMP- plus
  # a short unique suffix (e.g. EMP-A1B2C3D4). The office can still set their own.
  before_create :assign_reference

  private

  def assign_reference
    return if employee_reference.present?

    self.employee_reference = "EMP-#{SecureRandom.hex(4).upcase}"
  end
end
