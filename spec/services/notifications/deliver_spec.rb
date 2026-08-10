require "rails_helper"

RSpec.describe Notifications::Deliver, type: :service do
  let(:admin) { create(:admin, email: "boss@bpc.test") }

  it "writes an email notification and sends it by default" do
    perform_enqueued_jobs do
      described_class.call(recipients: admin, category: "missed_visit", title: "Missed visit", channels: %w[email])
    end

    notification = Notification.find_by(recipient: admin, channel: "email")
    expect(notification).to have_attributes(status: "sent")
    expect(ActionMailer::Base.deliveries.flat_map(&:to)).to include("boss@bpc.test")
  end

  it "honours an email opt-out preference for that category" do
    NotificationPreference.create!(owner: admin, notification_type: "missed_visit",
                                   email: false, in_app: true, push: true)

    perform_enqueued_jobs do
      described_class.call(recipients: admin, category: "missed_visit", title: "Missed visit", channels: %w[email])
    end

    expect(Notification.where(recipient: admin, channel: "email")).to be_empty
    expect(ActionMailer::Base.deliveries).to be_empty
  end
end
