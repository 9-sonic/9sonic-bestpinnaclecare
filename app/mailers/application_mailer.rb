class ApplicationMailer < ActionMailer::Base
  default from: "Best Pinnacle Care <noreply@bestpinnaclecare.co.uk>"
  layout "mailer"

  private

  # Reset / invite links go to the right frontend for the identity's scope:
  # admin -> the office web app, staff/carer -> the PWA.
  def frontend_base(scope)
    case scope.to_s
    when "admin" then ENV.fetch("ADMIN_URL", "http://localhost:5174")
    else              ENV.fetch("STAFF_URL", "http://localhost:5173")
    end
  end
end
