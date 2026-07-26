require "swagger_helper"
require "webauthn/fake_client"

RSpec.describe "WebAuthn (carer passkeys)", type: :request do
  before { WebAuthn.configuration.allowed_origins = [ "http://localhost" ] }

  let(:client)   { WebAuthn::FakeClient.new("http://localhost") }
  let(:employee) { create(:employee, password: "secret12") }

  # Registers a credential for `employee` using `client` (so client.get can sign later).
  def register_passkey(employee, client)
    opts = WebAuthn::Credential.options_for_create(user: { id: employee.webauthn_handle, name: employee.email })
    parsed = WebAuthn::Credential.from_create(client.create(challenge: opts.challenge))
    employee.webauthn_credentials.create!(external_id: parsed.id, public_key: parsed.public_key, sign_count: parsed.sign_count)
  end

  path "/api/v1/staff/webauthn/registration/options" do
    post("Passkey registration options") do
      tags "WebAuthn"
      produces "application/json"
      security [ bearerAuth: [] ]
      description "Returns WebAuthn PublicKeyCredentialCreationOptions plus a signed challenge_token to echo back."
      response(200, "creation options") do
        schema type: :object, properties: {
          challenge_token: { type: :string },
          options: { type: :object, description: "PublicKeyCredentialCreationOptions (base64url fields) for navigator.credentials.create()" }
        }
        let(:Authorization) { "Bearer #{jwt_for(employee, :employee)}" }
        run_test!
      end
    end
  end

  path "/api/v1/staff/webauthn/registration" do
    post("Register a passkey") do
      tags "WebAuthn"
      consumes "application/json"
      produces "application/json"
      security [ bearerAuth: [] ]
      description "Verifies the attestation from navigator.credentials.create() and stores the public-key credential."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          challenge_token: { type: :string },
          credential:      { type: :object, description: "PublicKeyCredential from navigator.credentials.create()" },
          nickname:        { type: :string }
        },
        required: %w[challenge_token credential]
      }
      response(201, "passkey stored") do
        schema type: :object, properties: { id: { type: :integer }, nickname: { type: :string, nullable: true } }
        let(:Authorization) { "Bearer #{jwt_for(employee, :employee)}" }
        let(:reg_opts) { WebAuthn::Credential.options_for_create(user: { id: employee.webauthn_handle, name: employee.email }) }
        let(:body) do
          {
            challenge_token: Webauthn::ChallengeToken.issue(reg_opts.challenge, :reg),
            credential:      client.create(challenge: reg_opts.challenge),
            nickname:        "iPhone"
          }
        end
        run_test!
      end
    end
  end

  path "/api/v1/staff/webauthn/authentication/options" do
    post("Passkey authentication options") do
      tags "WebAuthn"
      consumes "application/json"
      produces "application/json"
      description "Returns PublicKeyCredentialRequestOptions for a passwordless (biometric) login."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { email: { type: :string } }, required: %w[email]
      }
      response(200, "request options") do
        schema type: :object, properties: {
          challenge_token: { type: :string },
          options: { type: :object, description: "PublicKeyCredentialRequestOptions for navigator.credentials.get()" }
        }
        before { register_passkey(employee, client) }
        let(:body) { { email: employee.email } }
        run_test!
      end

      response(404, "no passkey enrolled") do
        schema "$ref" => "#/components/schemas/Error"
        let(:body) { { email: "ghost@bestpinnacle.test" } }
        run_test!
      end
    end
  end

  path "/api/v1/staff/webauthn/authentication" do
    post("Log in with a passkey (biometric)") do
      tags "WebAuthn"
      consumes "application/json"
      produces "application/json"
      description "Verifies the assertion from navigator.credentials.get() and issues an access token."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { challenge_token: { type: :string }, credential: { type: :object } },
        required: %w[challenge_token credential]
      }
      response(200, "authenticated") do
        schema type: :object, properties: {
          access:   { type: :string },
          employee: { "$ref" => "#/components/schemas/Employee" }
        }
        before { register_passkey(employee, client) }
        let(:auth_opts) { WebAuthn::Credential.options_for_get(allow: employee.webauthn_credentials.pluck(:external_id)) }
        let(:body) do
          {
            challenge_token: Webauthn::ChallengeToken.issue(auth_opts.challenge, :auth),
            credential:      client.get(challenge: auth_opts.challenge)
          }
        end
        run_test!
      end
    end
  end
end
