class Message < ApplicationRecord
  belongs_to :conversation, touch: :last_message_at
  belongs_to :sender, polymorphic: true, optional: true   # Admin | Employee; nil for system messages
  belongs_to :visit, optional: true                        # a "shift" attached to the message
  belongs_to :pinned_by, polymorphic: true, optional: true
  # A reply points back at the message it answers (same table). Optional — most
  # messages aren't replies. If the original is deleted the FK nullifies, so a
  # reply survives on its own.
  belongs_to :reply_to, class_name: "Message", optional: true
  has_many   :replies, class_name: "Message", foreign_key: :reply_to_id, dependent: :nullify, inverse_of: :reply_to
  has_many   :message_receipts, dependent: :destroy
  has_many_attached :files

  # Cap each attachment at 25 MB. Enforced on the model so it holds however the
  # file arrives (any client, the API directly) — the composer also checks before
  # upload for a friendlier message, but this is the real gate. Any file type is
  # allowed (docs, images, audio, video); only the size is bounded.
  MESSAGE_FILE_MAX_BYTES = 25.megabytes

  # A human message must have a sender; only system messages may omit it.
  validates :sender, presence: true, unless: :system?
  validate :attachments_within_size_limit

  private

  def attachments_within_size_limit
    files.each do |file|
      next if file.byte_size <= MESSAGE_FILE_MAX_BYTES

      errors.add(:files, "#{file.filename} is over #{MESSAGE_FILE_MAX_BYTES / 1.megabyte} MB")
    end
  end

  scope :visible, -> { where(deleted_at: nil) }
  scope :pinned,  -> { where.not(pinned_at: nil) }
end
