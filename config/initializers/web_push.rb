# Web Push (VAPID) configuration.
#
# The private key is a secret (env only, never committed); the public key is safe
# to expose and is what browsers subscribe with. If the keys are absent — e.g. a
# fresh environment that hasn't set them yet — push is simply DISABLED rather than
# raising, so a missing key can never break sign-in, clocking, or notifications.
#
# Read these through Rails.configuration.web_push wherever push is sent.
Rails.application.configure do
  config.web_push = ActiveSupport::OrderedOptions.new
  config.web_push.public_key  = ENV["VAPID_PUBLIC_KEY"].presence
  config.web_push.private_key = ENV["VAPID_PRIVATE_KEY"].presence
  # A contact for push services (mailto: or https URL), per the VAPID spec.
  config.web_push.subject     = ENV["VAPID_SUBJECT"].presence || "mailto:ops@bestpinnaclecare.co.uk"
  # True only when we can actually sign a push request.
  config.web_push.enabled     = config.web_push.public_key.present? && config.web_push.private_key.present?
end
