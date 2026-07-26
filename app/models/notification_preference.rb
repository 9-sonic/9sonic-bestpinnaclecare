class NotificationPreference < ApplicationRecord
  belongs_to :owner, polymorphic: true   # Admin | Employee
end
