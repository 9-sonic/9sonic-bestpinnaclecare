# Lightweight role enforcement for admin endpoints. Controllers call
# `authorize_role!(:registered_manager, :manager, ...)` in a before_action.
module RoleAuthorization
  extend ActiveSupport::Concern

  private

  def authorize_role!(*allowed)
    return if allowed.map(&:to_s).include?(current_admin&.role.to_s)

    render json: { error: "forbidden", required_roles: allowed.map(&:to_s) }, status: :forbidden
  end
end
