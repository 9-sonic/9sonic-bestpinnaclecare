require "rails_helper"

# Push is on by default for every category, same as in_app/email — governed
# by NotificationPreference#push (defaults true), not a hardcoded allowlist.
# A recipient can turn push off per category; nothing else gates it.
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

  it "creates a push row for any other category by default (not a hardcoded allowlist)" do
    described_class.call(recipients: admin, category: "late_arrival", title: "Late arrival", channels: %w[push])
    expect(push_rows).to exist
  end

  it "honours a recipient's push preference turned off for that category" do
    NotificationPreference.create!(owner: admin, notification_type: "late_arrival", push: false)
    described_class.call(recipients: admin, category: "late_arrival", title: "Late arrival", channels: %w[push])
    expect(push_rows).not_to exist
  end

  it "still writes the in-app row even when push is off for that category" do
    NotificationPreference.create!(owner: admin, notification_type: "late_arrival", push: false)
    described_class.call(recipients: admin, category: "late_arrival", title: "Late arrival", channels: %w[in_app push])
    expect(Notification.where(recipient: admin, channel: "in_app")).to exist
    expect(push_rows).not_to exist
  end

  it "enqueues the push job for a push row" do
    expect(Notifications::PushNotificationJob).to receive(:perform_later)
    described_class.call(recipients: admin, category: "no_clock_out", title: "No clock out", channels: %w[push])
  end
end
