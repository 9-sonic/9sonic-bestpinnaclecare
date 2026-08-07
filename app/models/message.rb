class Message < ApplicationRecord
  belongs_to :conversation, touch: :last_message_at
  belongs_to :sender, polymorphic: true, optional: true   # Admin | Employee; nil for system messages
  belongs_to :visit, optional: true                        # a "shift" attached to the message
  belongs_to :pinned_by, polymorphic: true, optional: true
  has_many   :message_receipts, dependent: :destroy
  has_many_attached :files

  # A human message must have a sender; only system messages may omit it.
  validates :sender, presence: true, unless: :system?

  scope :visible, -> { where(deleted_at: nil) }
  scope :pinned,  -> { where.not(pinned_at: nil) }
end
