class ApplicationMailer < ActionMailer::Base
  default from: "from@example.com"
  layout "mailer"

  private

  # Reset / invite links go to the right frontend for the identity's scope:
  # admin -> the office web app, staff/carer -> the PWA.
  def frontend_base(scope)
    case scope.to_s
    when "admin" then ENV.fetch("ADMIN_URL", "http://localhost:5174")
    else              ENV.fetch("CARER_URL", "http://localhost:5173")
    end
  end
end
