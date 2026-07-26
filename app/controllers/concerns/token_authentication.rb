# Shared login flow for the two identities. Verifies credentials (with Devise
# lockable counting + the active gate). If MFA is active, returns a short-lived
# challenge instead of a token; otherwise mints a devise-jwt access token.
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

  # Mints the JWT (also mirrored into the Authorization response header) and
  # renders { access, <scope>: {...} } plus any extras.
  def render_access(resource, scope_name, serializer, extra = {})
    token, = Warden::JWTAuth::UserEncoder.new.call(resource, scope_name, nil)
    response.set_header("Authorization", "Bearer #{token}")
    render json: { access: token, scope_name => serializer.call(resource) }.merge(extra), status: :ok
  end

  def login_params
    params.permit(:email, :password)
  end
end
