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

  # Absolute URL for a resized variant of an image attachment (e.g. an avatar),
  # so the frontend loads a small square instead of the multi-MB original. Same
  # host logic as .for. Falls back to the raw blob for non-image attachments or
  # if variant processing is unavailable — never worse than serving the original.
  def variant(attachment, transformations)
    return nil if attachment.nil?
    return nil if attachment.respond_to?(:attached?) && !attachment.attached?
    return self.for(attachment) unless attachment.content_type&.start_with?("image/") && attachment.variable?

    uri = URI.parse(ENV.fetch("APP_URL", "http://localhost:3002"))
    Rails.application.routes.url_helpers.rails_representation_url(
      attachment.variant(transformations), host: uri.host, port: uri.port, protocol: uri.scheme
    )
  rescue StandardError
    self.for(attachment)
  end
end
