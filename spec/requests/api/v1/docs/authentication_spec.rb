require "swagger_helper"

RSpec.describe "Authentication", type: :request do
  path "/api/v1/admin/auth/login" do
    post("Admin login") do
      tags "Auth — Admin"
      consumes "application/json"
      produces "application/json"
      description "Authenticates against the admins table only. Returns an access token, " \
                  "or an MFA challenge (mfa_required + mfa_token) when the admin has MFA enabled."
      parameter name: :credentials, in: :body, schema: {
        type: :object,
        properties: {
          email:    { type: :string, example: "boss@bestpinnacle.test" },
          password: { type: :string, example: "secret12" }
        },
        required: %w[email password]
      }

      response(200, "authenticated (or MFA challenge)") do
        schema type: :object, properties: {
          access:             { type: :string, nullable: true },
          admin:              { "$ref" => "#/components/schemas/Admin" },
          mfa_required:       { type: :boolean, nullable: true },
          mfa_token:          { type: :string, nullable: true },
          mfa_setup_required: { type: :boolean, nullable: true }
        }
        let!(:admin) { create(:admin, email: "boss@bestpinnacle.test", password: "secret12", mfa_enabled: false) }
        let(:credentials) { { email: "boss@bestpinnacle.test", password: "secret12" } }
        run_test!
      end

      response(401, "invalid credentials") do
        schema "$ref" => "#/components/schemas/Error"
        let(:credentials) { { email: "nobody@x.test", password: "bad" } }
        run_test!
      end
    end
  end

  path "/api/v1/staff/auth/login" do
    post("Carer login") do
      tags "Auth — Staff"
      consumes "application/json"
      produces "application/json"
      description "Authenticates against the employees table only."
      parameter name: :credentials, in: :body, schema: {
        type: :object,
        properties: { email: { type: :string }, password: { type: :string } },
        required: %w[email password]
      }

      response(200, "authenticated") do
        schema type: :object, properties: {
          access:   { type: :string },
          employee: { "$ref" => "#/components/schemas/Employee" }
        }
        let!(:employee) { create(:employee, email: "carer@bestpinnacle.test", password: "secret12") }
        let(:credentials) { { email: "carer@bestpinnacle.test", password: "secret12" } }
        run_test!
      end

      response(401, "invalid credentials") do
        schema "$ref" => "#/components/schemas/Error"
        let(:credentials) { { email: "x@y.test", password: "bad" } }
        run_test!
      end
    end
  end

  path "/api/v1/auth/mfa" do
    post("Complete MFA (two-step login)") do
      tags "Auth"
      consumes "application/json"
      produces "application/json"
      description "Exchanges the mfa_token from login + a TOTP or backup code for an access token."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { mfa_token: { type: :string }, otp_code: { type: :string, example: "123456" } },
        required: %w[mfa_token otp_code]
      }

      response(200, "authenticated") do
        schema type: :object, properties: {
          access: { type: :string },
          admin:  { "$ref" => "#/components/schemas/Admin" }
        }
        let(:admin) { create(:admin, :with_mfa, password: "secret12") }
        let(:body) { { mfa_token: Mfa::ChallengeToken.issue(admin, :admin), otp_code: ROTP::TOTP.new(admin.mfa_secret).now } }
        run_test!
      end

      response(401, "invalid or expired code") do
        schema "$ref" => "#/components/schemas/Error"
        let(:admin) { create(:admin, :with_mfa) }
        let(:body) { { mfa_token: Mfa::ChallengeToken.issue(admin, :admin), otp_code: "000000" } }
        run_test!
      end
    end
  end

  path "/api/v1/auth/logout" do
    delete("Log out (revoke token)") do
      tags "Auth"
      security [ bearerAuth: [] ]
      description "Denylists the presented bearer token. Requires a valid admin or employee token."
      response(204, "logged out") do
        let(:admin) { create(:admin) }
        let(:Authorization) { "Bearer #{jwt_for(admin, :admin)}" }
        run_test!
      end

      response(401, "unauthenticated") do
        schema "$ref" => "#/components/schemas/Error"
        let(:Authorization) { "" }
        run_test!
      end
    end
  end

  path "/api/v1/admin/me" do
    get("Current admin") do
      tags "Auth — Admin"
      produces "application/json"
      security [ bearerAuth: [] ]
      response(200, "the signed-in admin") do
        schema "$ref" => "#/components/schemas/Admin"
        let(:admin) { create(:admin) }
        let(:Authorization) { "Bearer #{jwt_for(admin, :admin)}" }
        run_test!
      end

      response(401, "missing/invalid token") do
        schema "$ref" => "#/components/schemas/Error"
        let(:Authorization) { "" }
        run_test!
      end
    end
  end

  path "/api/v1/staff/me" do
    get("Current carer") do
      tags "Auth — Staff"
      produces "application/json"
      security [ bearerAuth: [] ]
      response(200, "the signed-in carer") do
        schema "$ref" => "#/components/schemas/Employee"
        let(:employee) { create(:employee) }
        let(:Authorization) { "Bearer #{jwt_for(employee, :employee)}" }
        run_test!
      end
    end
  end
end
