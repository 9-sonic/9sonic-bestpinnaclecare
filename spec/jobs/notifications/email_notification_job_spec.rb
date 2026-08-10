require "rails_helper"

RSpec.describe Notifications::EmailNotificationJob, type: :job do
  let(:admin) { create(:admin, email: "boss@bpc.test") }

  def email_notification(**attrs)
    Notification.create!({
      recipient: admin, notification_type: "alert", title: "Missed visit",
      body: "Ada Whitfield at 9am", channel: "email", status: "queued"
    }.merge(attrs))
  end

  it "sends the email and marks the notification sent" do
    notification = email_notification
    expect { described_class.perform_now(notification.id) }
      .to change { ActionMailer::Base.deliveries.size }.by(1)
    expect(notification.reload.status).to eq("sent")
    expect(notification.sent_at).to be_present
    expect(ActionMailer::Base.deliveries.last.to).to eq([ "boss@bpc.test" ])
  end

  it "does nothing for a non-email channel row" do
    notification = email_notification(channel: "in_app")
    expect { described_class.perform_now(notification.id) }
      .not_to change { ActionMailer::Base.deliveries.size }
  end

  it "records the failure and re-raises when delivery blows up" do
    notification = email_notification
    allow(NotificationMailer).to receive(:notify).and_raise(StandardError, "smtp down")

    expect { described_class.perform_now(notification.id) }.to raise_error(StandardError, "smtp down")
    expect(notification.reload).to have_attributes(status: "failed", failed_reason: "smtp down")
  end
end
