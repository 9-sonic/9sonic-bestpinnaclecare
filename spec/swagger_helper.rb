# frozen_string_literal: true

require 'rails_helper'

RSpec.configure do |config|
  config.openapi_root = Rails.root.join('swagger').to_s

  config.openapi_specs = {
    'v1/swagger.yaml' => {
      openapi: '3.0.1',
      info: {
        title: 'Best Pinnacle Care API',
        version: 'v1',
        description: <<~MD
          Phase 1 API. Two separate identities with separate logins:
          **Admin** (office) and **Employee** (carer PWA).

          Auth is JWT (bearer). Log in at the identity-specific endpoint to get an
          `access` token, then send `Authorization: Bearer <token>`. Admins may have
          TOTP MFA (two-step login); carers can log in with a passkey (WebAuthn).
        MD
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Local development' }
      ],
      components: {
        securitySchemes: {
          bearerAuth: { type: :http, scheme: :bearer, bearerFormat: 'JWT' }
        },
        schemas: {
          Error: {
            type: :object,
            properties: {
              error:   { type: :string, example: 'invalid_credentials' },
              details: { type: :object, nullable: true }
            },
            required: %w[error]
          },
          Admin: {
            type: :object,
            properties: {
              id:          { type: :integer, example: 1 },
              email:       { type: :string, format: :email, example: 'boss@bestpinnacle.test' },
              first_name:  { type: :string, example: 'Reg' },
              last_name:   { type: :string, example: 'Manager' },
              full_name:   { type: :string, example: 'Reg Manager' },
              role:        { type: :string, enum: %w[registered_manager manager coordinator finance auditor] },
              active:      { type: :boolean, example: true },
              mfa_enabled: { type: :boolean, example: true }
            }
          },
          Employee: {
            type: :object,
            properties: {
              id:                 { type: :integer, example: 1 },
              email:              { type: :string, format: :email, example: 'carer@bestpinnacle.test' },
              first_name:         { type: :string, example: 'Cara' },
              last_name:          { type: :string, example: 'Erikson' },
              full_name:          { type: :string, example: 'Cara Erikson' },
              role:               { type: :string, enum: %w[carer senior_carer] },
              employee_reference: { type: :string, nullable: true },
              active:             { type: :boolean, example: true },
              mfa_enabled:        { type: :boolean, example: false }
            }
          }
        }
      }
    }
  }

  config.openapi_format = :yaml
end
