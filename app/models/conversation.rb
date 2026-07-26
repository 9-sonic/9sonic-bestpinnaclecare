class Conversation < ApplicationRecord
  belongs_to :created_by, polymorphic: true, optional: true
  has_many   :conversation_participants, dependent: :destroy
  has_many   :messages, dependent: :destroy
  has_one    :last_message, -> { order(created_at: :desc) }, class_name: "Message"

  # scopes: false — a `group` scope would collide with ActiveRecord's `.group`.
  enum :kind, { direct: "direct", group: "group" }, scopes: false

  # direct_key: sorted "Type:id" pair, e.g. "Admin:3|Employee:12" -> one thread per pair
  def self.direct_key_for(a, b) = [ "#{a.class}:#{a.id}", "#{b.class}:#{b.id}" ].sort.join("|")
end
