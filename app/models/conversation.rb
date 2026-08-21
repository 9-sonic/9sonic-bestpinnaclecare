class Conversation < ApplicationRecord
  belongs_to :created_by, polymorphic: true, optional: true
  has_many   :conversation_participants, dependent: :destroy
  has_many   :messages, dependent: :destroy
  # Both ignore deleted messages: the thread's preview and pinned banner should
  # never surface something that's been removed (its body is gone anyway).
  has_one    :last_message, -> { where(deleted_at: nil).order(created_at: :desc) }, class_name: "Message"
  has_one    :pinned_message, -> { where(deleted_at: nil).where.not(pinned_at: nil).order(pinned_at: :desc) }, class_name: "Message"

  scope :auto_posting_channels, -> { where(kind: :channel, auto_post: true) }

  # scopes: false — a `group` scope would collide with ActiveRecord's `.group`.
  enum :kind, { direct: "direct", group: "group", channel: "channel" }, scopes: false

  # direct_key: sorted "Type:id" pair, e.g. "Admin:3|Employee:12" -> one thread per pair
  def self.direct_key_for(a, b) = [ "#{a.class}:#{a.id}", "#{b.class}:#{b.id}" ].sort.join("|")
end
