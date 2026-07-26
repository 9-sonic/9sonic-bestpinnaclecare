# Password reset for either identity. Including controllers define
# reset_resource_class and reset_scope.
module PasswordManagement
  extend ActiveSupport::Concern

  # POST .../auth/password { email } — request a reset link (always 202).
  def create
    Passwords::RequestReset.call(reset_resource_class, params[:email], reset_scope)
    head :accepted
  end

  # PUT .../auth/password { token, password } — set a new password.
  def update
    resource = Passwords::PerformReset.call(reset_resource_class, params[:token], params[:password])
    if resource.errors.empty?
      head :no_content
    else
      render json: { error: "reset_failed", details: resource.errors.messages }, status: :unprocessable_entity
    end
  end
end
