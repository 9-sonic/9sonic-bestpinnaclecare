require "rails_helper"

# Push is opt-in by category: only the critical care alerts and messages may
# create a push notification, regardless of what a caller requests. These specs
# lock that policy down (Deliver::PUSHABLE_CATEGORIES).
RSpec.describe Notifications::Deliver, "push channel scoping", type: :service do
  let(:admin) { create(:admin, email: "boss@bpc.test") }

  def push_rows(recipient: admin)
    Notification.where(recipient: recipient, channel: "push")
  end

  it "creates a push row for a critical alert category" do
    described_class.call(recipients: admin, category: "missed_visit", title: "Missed visit", channels: %w[push])
    expect(push_rows).to exist
  end

  it "creates a push row for a message" do
    described_class.call(recipients: admin, category: "message", kind: "message", title: "New message", channels: %w[push])
    expect(push_rows).to exist
  end

  it "does NOT create a push row for a non-pushable category, even when push is requested" do
    described_class.call(recipients: admin, category: "late_arrival", title: "Late arrival", channels: %w[push])
    expect(push_rows).not_to exist
  end

  it "still writes the in-app row for a non-pushable category" do
    described_class.call(recipients: admin, category: "late_arrival", title: "Late arrival", channels: %w[in_app push])
    expect(Notification.where(recipient: admin, channel: "in_app")).to exist
    expect(push_rows).not_to exist
  end

  it "enqueues the push job for a push row" do
    expect(Notifications::PushNotificationJob).to receive(:perform_later)
    described_class.call(recipients: admin, category: "no_clock_out", title: "No clock out", channels: %w[push])
  end
end
