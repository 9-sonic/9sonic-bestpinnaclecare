# Shared login flow for the two identities. Verifies credentials (with Devise
# lockable counting + the active gate). If MFA is active, returns a short-lived
# challenge instead of a token; otherwise mints an access token + refresh token.
module TokenAuthentication
  extend ActiveSupport::Concern

  SERIALIZERS = { admin: AdminSerializer, employee: EmployeeSerializer }.freeze

  private

  def login_with(resource_class, scope_name, serializer)
    email = login_params[:email].to_s.downcase
    resource = resource_class.find_for_database_authentication(email: email)

    unless resource&.valid_for_authentication? { resource.valid_password?(login_params[:password]) } &&
           resource.active_for_authentication?
      Auth::RecordLoginAttempt.call(
        scope: scope_name, request: request, attempted_email: email, resource: resource,
        success: false, failure_reason: "invalid_credentials"
      )
      return render json: { error: "invalid_credentials" }, status: :unauthorized
    end

    if resource.mfa_active?
      # Not a completed login yet — the MFA step records its own outcome.
      render json: { mfa_required: true, mfa_token: Mfa::ChallengeToken.issue(resource, scope_name) }, status: :ok
    else
      extra = resource.mfa_setup_required? ? { mfa_setup_required: true } : {}
      render_access(resource, scope_name, serializer, extra)
    end
  end

  # Mints access + refresh tokens and renders { access, access_expires_at,
  # refresh_token, <scope>: {...} } plus any extras. The one place every login
  # method (password, MFA-verified, WebAuthn) ends up, so it's also the one
  # place a successful login is recorded.
  def render_access(resource, scope_name, serializer, extra = {})
    Auth::RecordLoginAttempt.call(scope: scope_name, request: request, resource: resource, success: true)
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
