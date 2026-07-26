source "https://rubygems.org"

# Bundle edge Rails instead: gem "rails", github: "rails/rails", branch: "main"
gem "rails", "~> 8.1.3"
# Use postgresql as the database for Active Record
gem "pg", "~> 1.1"
# Use the Puma web server [https://github.com/puma/puma]
gem "puma", ">= 5.0"
# Build JSON APIs with ease [https://github.com/rails/jbuilder]
# gem "jbuilder"

# Use Active Model has_secure_password [https://guides.rubyonrails.org/active_model_basics.html#securepassword]
gem "bcrypt", "~> 3.1.7"

# Authentication (Admin + Employee) with JWT for the API
gem "devise"
gem "devise-jwt"

# TOTP multi-factor auth (authenticator app + QR enrolment)
gem "rotp"
gem "rqrcode"

# Biometric/passkey login for the carer PWA (WebAuthn / FIDO2)
gem "webauthn"

# Geocode service-user home addresses -> lat/lng (geofence centre)
gem "geocoder"

# Timesheet exports (CSV is no longer a default gem on Ruby 4.0; caxlsx for XLSX)
gem "csv"
gem "caxlsx"

# Request throttling / rate limiting
gem "rack-attack"

# OpenAPI/Swagger docs (served at /api-docs) generated from request specs
gem "rswag-api"
gem "rswag-ui"
gem "ostruct" # rswag-ui needs it; no longer a default gem on Ruby 4.0

# Windows does not include zoneinfo files, so bundle the tzinfo-data gem
gem "tzinfo-data", platforms: %i[ windows jruby ]

# Use the database-backed adapters for Rails.cache, Active Job, and Action Cable
gem "solid_cache"
gem "solid_queue"
gem "solid_cable"

# Reduces boot times through caching; required in config/boot.rb
gem "bootsnap", require: false

# Deploy is via GitHub Actions (rsync + rbenv + systemd to the Virtualmin host),
# see .github/workflows/deploy.yml — no Kamal/Docker.

# Use Active Storage variants [https://guides.rubyonrails.org/active_storage_overview.html#transforming-images]
gem "image_processing", "~> 1.2"

# Use Rack CORS for handling Cross-Origin Resource Sharing (CORS), making cross-origin Ajax possible
gem "rack-cors"

group :development, :test do
  # See https://guides.rubyonrails.org/debugging_rails_applications.html#debugging-with-the-debug-gem
  gem "debug", platforms: %i[ mri windows ], require: "debug/prelude"

  # RSpec test framework and fixtures replacement.
  gem "rspec-rails"
  gem "factory_bot_rails"

  # Generates the OpenAPI doc from request specs (rake rswag:specs:swaggerize)
  gem "rswag-specs"

  # Audits gems for known security defects (use config/bundler-audit.yml to ignore issues)
  gem "bundler-audit", require: false

  # Static analysis for security vulnerabilities [https://brakemanscanner.org/]
  gem "brakeman", require: false

  # Omakase Ruby styling [https://github.com/rails/rubocop-rails-omakase/]
  gem "rubocop-rails-omakase", require: false
end

group :test do
  # One-liner matchers for common Rails functionality.
  gem "shoulda-matchers", "~> 6.0"
end
