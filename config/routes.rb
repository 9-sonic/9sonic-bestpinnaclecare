Rails.application.routes.draw do
  mount Rswag::Ui::Engine => "/api-docs"
  mount Rswag::Api::Engine => "/api-docs"
  # Health check for load balancers / uptime monitors.
  get "up" => "rails/health#show", as: :rails_health_check

  # Register Devise mappings + Warden JWT strategies and the current_admin /
  # current_employee / authenticate_*! helpers, without any default routes.
  devise_for :admins,    skip: :all
  devise_for :employees, skip: :all

  namespace :api do
    namespace :v1 do
      # Shared auth (caller may be Admin or Employee; token carries the scope).
      delete "auth/logout",  to: "sessions#logout"
      post   "auth/mfa",     to: "mfa_sessions#create"   # two-step MFA: exchange challenge + code for a token
      post   "auth/refresh", to: "refresh#create"        # rotate refresh -> new access
      delete "auth/refresh", to: "refresh#destroy"       # revoke a refresh token

      # Shared notifications (recipient is Admin or Employee)
      get   "notifications",            to: "notifications#index"
      post  "notifications/seen_all",   to: "notifications#seen_all"
      post  "notifications/:id/seen",   to: "notifications#seen"
      get   "notification_preferences", to: "notification_preferences#index"
      patch "notification_preferences", to: "notification_preferences#update"

      # Shared chat (participants are Admin or Employee)
      resources :conversations, only: %i[index create] do
        resources :messages, only: %i[index create]
      end
      post "messages/:id/receipts", to: "message_receipts#create"

      # Office (Admin)
      namespace :admin do
        post "auth/login",    to: "auth#create"
        post "auth/password", to: "passwords#create"   # request reset email
        put  "auth/password", to: "passwords#update"    # perform reset with token
        post "mfa",           to: "mfa#create"          # begin TOTP enrolment
        post "mfa/confirm",   to: "mfa#confirm"          # activate + return backup codes
        get  "me",            to: "me#show"

        # Domain: service users, care packages, visits, assignments
        resources :service_users, only: %i[index show create update] do
          resources :care_plan_items, only: %i[index create update destroy]
        end
        resources :care_package_slots, only: %i[index create update]
        resources :visits, only: %i[index create] do
          member     { post :publish }
          collection { post :generate }   # generate dated visits from care packages
        end
        resources :visit_assignments, only: %i[create destroy]

        # User management (invitations)
        resources :employees, only: %i[index show create update] do
          member { get :availability }
        end
        resources :admins,    only: %i[index show create update]

        # Provider config, dashboard, rota copy
        resource :settings, only: %i[show update], controller: "settings"
        get  "dashboard",   to: "dashboard#index"
        post "rota_copies", to: "rota_copies#create"

        # Monitoring + corrections
        get  "live_board",        to: "live_board#index"
        get  "exceptions",        to: "exceptions#index"
        post "clock_corrections", to: "clock_corrections#create"
        resources :alerts, only: %i[index] do
          member do
            post :acknowledge
            post :resolve
          end
        end

        # Timesheets / attendance
        resources :timesheet_periods, only: %i[index show create] do
          member do
            post :approve
            post :lock
          end
        end
        get "timesheet_exports/:id", to: "timesheet_exports#show"
        resources :timesheet_disputes, only: %i[index] do
          member { post :resolve }
        end
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

        # Visits + geofenced clock-in/out + offline sync
        get  "visits", to: "visits#index"
        post "visit_assignments/:visit_assignment_id/clock", to: "clock#create"
        post "sync/events",  to: "sync#events"
        get  "sync/changes", to: "sync#changes"

        # Attendance
        get  "timesheet",         to: "timesheet#show"
        get  "timesheet_periods", to: "timesheet_periods#index"
        post "disputes",          to: "disputes#create"

        # Profile, availability, summary
        patch "me",           to: "me#update"
        get   "availability", to: "availability#show"
        put   "availability", to: "availability#update"
        get   "summary",      to: "summary#show"

        # Visit detail (care plan + tasks + notes)
        get   "visit_assignments/:id",       to: "visit_assignments#show"
        patch "visit_assignments/:id/tasks", to: "visit_assignments#update_tasks"
        post  "visit_assignments/:id/note",  to: "visit_assignments#create_note"
        post  "visit_assignments/:visit_assignment_id/break", to: "breaks#create"

        # Mileage
        get  "mileage", to: "mileage#index"
        post "mileage", to: "mileage#create"

        # Devices (push) + passkey management
        post   "devices", to: "devices#create"
        delete "devices/:fingerprint", to: "devices#destroy"
        get    "webauthn/credentials",     to: "webauthn_credentials#index"
        delete "webauthn/credentials/:id", to: "webauthn_credentials#destroy"
      end
    end
  end
end
