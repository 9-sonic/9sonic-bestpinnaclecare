# One delivery of a heads-up to one person on one channel.
class Notification < ApplicationRecord
  belongs_to :recipient, polymorphic: true   # Admin | Employee
  belongs_to :alert, optional: true
  belongs_to :subject, polymorphic: true, optional: true
end
