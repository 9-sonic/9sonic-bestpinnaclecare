require "rails_helper"

RSpec.describe Notifications::PushNotificationJob, type: :job do
  let(:admin) { create(:admin) }

  # A registered browser with a valid-looking Web Push subscription.
  def register_device(owner: admin, **attrs)
    owner.devices.create!({
      fingerprint: SecureRandom.uuid,
      push_subscription: {
        "endpoint" => "https://push.example.com/abc",
        "keys" => { "p256dh" => "p256dh-key", "auth" => "auth-key" }
      }
    }.merge(attrs))
  end

  def push_notification(**attrs)
    Notification.create!({
      recipient: admin, notification_type: "alert", title: "Missed visit",
      body: "Ada Whitfield at 9am", channel: "push", status: "queued"
    }.merge(attrs))
  end

  it "sends to the registered device and marks the notification sent" do
    register_device
    notification = push_notification
    expect(WebPush).to receive(:payload_send).once.and_return(true)

    described_class.perform_now(notification.id)

    expect(notification.reload).to have_attributes(status: "sent")
    expect(notification.sent_at).to be_present
  end

  it "does nothing for a non-push channel row" do
    register_device
    notification = push_notification(channel: "in_app")
    expect(WebPush).not_to receive(:payload_send)
    described_class.perform_now(notification.id)
  end

  it "fails cleanly (no raise) when the recipient has no push devices" do
    notification = push_notification
    expect(WebPush).not_to receive(:payload_send)
    expect { described_class.perform_now(notification.id) }.not_to raise_error
    expect(notification.reload).to have_attributes(status: "failed", failed_reason: "no registered push devices")
  end

  it "prunes an expired subscription and does not keep trying it" do
    device = register_device
    notification = push_notification
    allow(WebPush).to receive(:payload_send).and_raise(WebPush::ExpiredSubscription.new(double(inspect: "410", body: ""), "push.example.com"))

    described_class.perform_now(notification.id)

    expect(device.reload.push_subscription).to be_nil
    expect(device.revoked_at).to be_present
    expect(notification.reload).to have_attributes(status: "failed", failed_reason: "all push endpoints failed")
  end

  it "still delivers to a good device when another one is dead" do
    good = register_device
    dead = register_device
    notification = push_notification
    allow(WebPush).to receive(:payload_send) do |endpoint:, **_|
      raise WebPush::ExpiredSubscription.new(double(inspect: "410", body: ""), "x") if endpoint == dead.push_subscription["endpoint"] && dead.reload.push_subscription
      true
    end
    # Force distinct endpoints so we can tell them apart.
    good.update!(push_subscription: good.push_subscription.merge("endpoint" => "https://push.example.com/good"))
    dead.update!(push_subscription: dead.push_subscription.merge("endpoint" => "https://push.example.com/dead"))

    described_class.perform_now(notification.id)

    expect(notification.reload.status).to eq("sent")
  end

  it "marks failed (no raise) when web push is not configured" do
    register_device
    notification = push_notification
    allow(Rails.configuration.web_push).to receive(:enabled).and_return(false)

    expect { described_class.perform_now(notification.id) }.not_to raise_error
    expect(notification.reload).to have_attributes(status: "failed", failed_reason: "web push not configured")
  end
end
