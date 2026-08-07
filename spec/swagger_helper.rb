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
              avatar_url:  { type: :string, nullable: true, description: 'Absolute URL of the uploaded avatar, or null.' },
              role:        { type: :string, enum: %w[registered_manager manager coordinator finance auditor] },
              active:      { type: :boolean, example: true },
              mfa_enabled: { type: :boolean, example: true }
            }
          },
          Employee: {
            type: :object,
            description: 'Private fields (emergency contact) appear only with include_private (self/office); pay fields only with include_pay (self/finance).',
            properties: {
              id:                        { type: :integer, example: 1 },
              email:                     { type: :string, format: :email, example: 'carer@bestpinnacle.test' },
              first_name:                { type: :string, example: 'Cara' },
              last_name:                 { type: :string, example: 'Erikson' },
              full_name:                 { type: :string, example: 'Cara Erikson' },
              phone:                     { type: :string, nullable: true, example: '07700 900000' },
              avatar_url:                { type: :string, nullable: true, description: 'Absolute URL of the uploaded avatar, or null.' },
              role:                      { type: :string, enum: %w[carer senior_carer] },
              employee_reference:        { type: :string, nullable: true },
              contracted_hours_per_week: { type: :number, nullable: true, example: 37.5 },
              active:                    { type: :boolean, example: true },
              mfa_enabled:               { type: :boolean, example: false },
              emergency_contact_name:    { type: :string, nullable: true, description: 'Only with include_private.' },
              emergency_contact_phone:   { type: :string, nullable: true, description: 'Only with include_private.' },
              hourly_rate_pence:         { type: :integer, nullable: true, description: 'Only with include_pay.' },
              mileage_rate_pence:        { type: :integer, nullable: true, description: 'Only with include_pay.' }
            }
          },
          ServiceUser: {
            type: :object,
            properties: {
              id: { type: :integer }, first_name: { type: :string }, last_name: { type: :string },
              full_name: { type: :string }, reference: { type: :string, nullable: true },
              phone: { type: :string, nullable: true },
              address_line1: { type: :string, nullable: true }, address_line2: { type: :string, nullable: true },
              city: { type: :string, nullable: true }, postcode: { type: :string, nullable: true },
              lat: { type: :number, nullable: true }, lng: { type: :number, nullable: true },
              geofence_radius_m: { type: :integer }, geofence_mode: { type: :string, nullable: true },
              access_notes: { type: :string, nullable: true }, active: { type: :boolean }
            }
          },
          Visit: {
            type: :object,
            properties: {
              id: { type: :integer }, service_user_id: { type: :integer },
              scheduled_start: { type: :string, format: 'date-time' },
              scheduled_end: { type: :string, format: 'date-time' },
              status: { type: :string, enum: %w[draft published cancelled] },
              staff_required: { type: :integer },
              notes: { type: :string, nullable: true },
              published_at: { type: :string, nullable: true },
              service_user: { allOf: [ { '$ref' => '#/components/schemas/ServiceUser' } ], nullable: true,
                description: 'Nested only when the endpoint sets include_service_user (e.g. visit list, visit detail).' }
            }
          },
          VisitAssignment: {
            type: :object,
            properties: {
              id: { type: :integer }, visit_id: { type: :integer }, employee_id: { type: :integer },
              lifecycle_state: { type: :string,
                enum: %w[scheduled check_in_window grace_period late in_progress overdue pending_review completed missed cancelled] },
              assignment_status: { type: :string },
              actual_start: { type: :string, format: 'date-time', nullable: true, description: 'Clock-in time.' },
              actual_end: { type: :string, format: 'date-time', nullable: true, description: 'Clock-out time.' },
              worked_minutes: { type: :integer, nullable: true },
              flags: { type: :array, items: { type: :string } },
              visit: { '$ref' => '#/components/schemas/Visit' }
            }
          }
        }
      }
    }
  }

  config.openapi_format = :yaml
end
