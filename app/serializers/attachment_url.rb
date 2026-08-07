# Builds an absolute URL for an ActiveStorage attachment. The office and carer
# apps are served from a different origin than the API, so relative paths won't
# resolve — we need the full API host. Host comes from APP_URL (default: the
# local API on :3002).
module AttachmentUrl
  module_function

  def for(attachment)
    return nil if attachment.nil?
    # has_one_attached responds to attached?; an individual has_many attachment does not.
    return nil if attachment.respond_to?(:attached?) && !attachment.attached?

    uri = URI.parse(ENV.fetch("APP_URL", "http://localhost:3002"))
    Rails.application.routes.url_helpers.rails_blob_url(
      attachment, host: uri.host, port: uri.port, protocol: uri.scheme
    )
  rescue StandardError
    nil
  end
end
