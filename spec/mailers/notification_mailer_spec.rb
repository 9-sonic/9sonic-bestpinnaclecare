require "rails_helper"

RSpec.describe NotificationMailer, type: :mailer do
  it "emails the recipient with the notification's title and body" do
    admin = create(:admin, email: "boss@bpc.test", first_name: "Reg")
    notification = Notification.create!(
      recipient: admin, notification_type: "alert", title: "Missed visit",
      body: "Ada Whitfield at 9am", channel: "email", status: "queued"
    )

    mail = NotificationMailer.notify(notification)

    expect(mail.to).to eq([ "boss@bpc.test" ])
    expect(mail.subject).to eq("Missed visit")
    expect(mail.body.encoded).to include("Reg").and include("Ada Whitfield at 9am")
  end
end
