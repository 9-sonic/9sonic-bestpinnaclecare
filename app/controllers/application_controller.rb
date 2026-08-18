class ApplicationController < ActionController::API
  include ErrorHandling

  before_action :set_current_request_context

  private

  # Populates Current so Events::Record can attach ip_address/device_fingerprint
  # to every audit event without every call site passing them explicitly.
  # device_fingerprint is opt-in via a request header — absent today from both
  # frontends, so this is a no-op until a client starts sending it.
  def set_current_request_context
    Current.ip_address = request.remote_ip
    Current.device_fingerprint = request.headers["X-Device-Fingerprint"].presence
  end
end
