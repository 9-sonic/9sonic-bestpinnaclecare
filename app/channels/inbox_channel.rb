# One subscription per signed-in identity that receives every new message across
# all of their conversations. The client routes each payload to the open thread
# (append) and the conversation list (bump preview / unread). Streaming per
# identity — not per conversation — means one socket covers the whole inbox and
# there is nothing to (un)subscribe as the user switches threads.
class InboxChannel < ApplicationCable::Channel
  def subscribed
    stream_from "inbox:#{identity_gid}"
  end
end
