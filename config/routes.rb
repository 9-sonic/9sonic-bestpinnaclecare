Rails.application.routes.draw do
  mount Rswag::Ui::Engine => '/api-docs'
  mount Rswag::Api::Engine => '/api-docs'
  # Health check for load balancers / uptime monitors.
  get "up" => "rails/health#show", as: :rails_health_check

  # Register Devise mappings + Warden JWT strategies and the current_admin /
  # current_employee / authenticate_*! helpers, without any default routes.
  devise_for :admins,    skip: :all
  devise_for :employees, skip: :all

  namespace :api do
    namespace :v1 do
      # Shared auth (caller may be Admin or Employee; token carries the scope).
      delete "auth/logout", to: "sessions#logout"
      post   "auth/mfa",    to: "mfa_sessions#create"   # two-step MFA: exchange challenge + code for a token

      # Office (Admin)
      namespace :admin do
        post "auth/login",    to: "auth#create"
        post "auth/password", to: "passwords#create"   # request reset email
        put  "auth/password", to: "passwords#update"    # perform reset with token
        post "mfa",           to: "mfa#create"          # begin TOTP enrolment
        post "mfa/confirm",   to: "mfa#confirm"          # activate + return backup codes
        get  "me",            to: "me#show"
      end

      # Carer PWA (Employee)
      namespace :staff do
        post "auth/login",    to: "auth#create"
        post "auth/password", to: "passwords#create"
        put  "auth/password", to: "passwords#update"
        post "mfa",           to: "mfa#create"
        post "mfa/confirm",   to: "mfa#confirm"
        get  "me",            to: "me#show"

        # Biometric / passkey (WebAuthn)
        post "webauthn/registration/options",   to: "webauthn_registrations#create_options"
        post "webauthn/registration",           to: "webauthn_registrations#create"
        post "webauthn/authentication/options", to: "webauthn_sessions#create_options"
        post "webauthn/authentication",         to: "webauthn_sessions#create"
      end
    end
  end
end
