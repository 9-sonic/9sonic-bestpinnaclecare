# Shared login flow for the two identities. Verifies credentials (with Devise
# lockable counting + the active gate). If MFA is active, returns a short-lived
# challenge instead of a token; otherwise mints an access token + refresh token.
module TokenAuthentication
  extend ActiveSupport::Concern

  SERIALIZERS = { admin: AdminSerializer, employee: EmployeeSerializer }.freeze

  private

  def login_with(resource_class, scope_name, serializer)
    resource = resource_class.find_for_database_authentication(email: login_params[:email].to_s.downcase)

    unless resource&.valid_for_authentication? { resource.valid_password?(login_params[:password]) } &&
           resource.active_for_authentication?
      return render json: { error: "invalid_credentials" }, status: :unauthorized
    end

    if resource.mfa_active?
      render json: { mfa_required: true, mfa_token: Mfa::ChallengeToken.issue(resource, scope_name) }, status: :ok
    else
      extra = resource.mfa_setup_required? ? { mfa_setup_required: true } : {}
      render_access(resource, scope_name, serializer, extra)
    end
  end

  # Mints access + refresh tokens and renders { access, access_expires_at,
  # refresh_token, <scope>: {...} } plus any extras.
  def render_access(resource, scope_name, serializer, extra = {})
    tokens = Auth::RefreshTokens.issue(resource: resource, scope: scope_name)
    response.set_header("Authorization", "Bearer #{tokens[:access]}")
    render json: {
      access:            tokens[:access],
      access_expires_at: tokens[:access_expires_at],
      refresh_token:     tokens[:refresh_token],
      scope_name => serializer.call(resource)
    }.merge(extra), status: :ok
  end

  def login_params
    params.permit(:email, :password)
  end
end
