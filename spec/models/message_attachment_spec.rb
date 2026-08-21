require "rails_helper"

RSpec.describe "Message attachment size limit", type: :model do
  let(:conversation) { Conversation.create!(kind: "group", title: "Team") }
  let(:sender)       { create(:employee) }

  # Build an in-memory uploadable file of a given size and content type.
  def blob(bytes:, filename:, content_type:)
    {
      io: StringIO.new("x" * bytes),
      filename: filename,
      content_type: content_type
    }
  end

  it "accepts a file under the 25 MB limit (any type)" do
    msg = conversation.messages.build(sender: sender, body: "here's the handover", client_message_id: SecureRandom.uuid)
    msg.files.attach(blob(bytes: 2.megabytes, filename: "clip.mp4", content_type: "video/mp4"))
    expect(msg.save).to be(true)
  end

  it "rejects a file over the 25 MB limit" do
    msg = conversation.messages.build(sender: sender, body: "big file", client_message_id: SecureRandom.uuid)
    msg.files.attach(blob(bytes: Message::MESSAGE_FILE_MAX_BYTES + 1, filename: "huge.mov", content_type: "video/quicktime"))
    expect(msg.save).to be(false)
    expect(msg.errors[:files].join).to match(/over 25 MB/)
  end

  it "allows several under-limit files of mixed types on one message" do
    msg = conversation.messages.build(sender: sender, body: "docs + photo + voice note", client_message_id: SecureRandom.uuid)
    msg.files.attach(blob(bytes: 1.megabyte, filename: "care-plan.pdf", content_type: "application/pdf"))
    msg.files.attach(blob(bytes: 3.megabytes, filename: "photo.jpg", content_type: "image/jpeg"))
    msg.files.attach(blob(bytes: 500.kilobytes, filename: "note.m4a", content_type: "audio/mp4"))
    expect(msg.save).to be(true)
  end
end
