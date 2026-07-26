class MessageReceipt < ApplicationRecord
  belongs_to :message
  belongs_to :recipient, polymorphic: true   # Admin | Employee
end
