RSpec.configure do |config|
  # Let specs perform enqueued mailer jobs (password reset uses deliver_later).
  config.include ActiveJob::TestHelper

  config.before { ActionMailer::Base.deliveries.clear }
end
