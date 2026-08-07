# Shared avatar upload/remove for the identities. Validates the uploaded file
# (type + size) before attaching it via ActiveStorage.
module AvatarManagement
  extend ActiveSupport::Concern

  AVATAR_MAX_BYTES = 5.megabytes
  AVATAR_TYPES = %w[image/png image/jpeg image/jpg image/webp image/gif].freeze

  private

  # Returns an error code string, or nil when the file is acceptable.
  def avatar_error(file)
    return "no_file"          unless file.respond_to?(:content_type)
    return "unsupported_type" unless AVATAR_TYPES.include?(file.content_type)
    return "too_large"        if file.size.to_i > AVATAR_MAX_BYTES

    nil
  end

  # Attach params[:avatar] to owner, or render a 422 and return false.
  def attach_avatar_or_422(owner)
    if (err = avatar_error(params[:avatar]))
      render json: { error: err }, status: :unprocessable_entity
      return false
    end
    owner.avatar.attach(params[:avatar])
    true
  end
end
