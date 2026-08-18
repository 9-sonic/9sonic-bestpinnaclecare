# Request-scoped context, set once per request in ApplicationController and
# read anywhere without threading it through every call site's arguments.
# Reset automatically between requests/jobs by Rails.
class Current < ActiveSupport::CurrentAttributes
  attribute :ip_address, :device_fingerprint
end
