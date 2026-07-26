class Message < ApplicationRecord
  belongs_to :conversation, touch: :last_message_at
  belongs_to :sender, polymorphic: true   # Admin | Employee
  has_many   :message_attachments, dependent: :destroy
  has_many   :message_receipts, dependent: :destroy

  scope :visible, -> { where(deleted_at: nil) }
end
