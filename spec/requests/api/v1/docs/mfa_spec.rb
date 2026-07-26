require "swagger_helper"

RSpec.describe "MFA management", type: :request do
  path "/api/v1/admin/mfa" do
    post("Begin TOTP enrolment") do
      tags "MFA"
      produces "application/json"
      security [ bearerAuth: [] ]
      description "Generates a TOTP secret and returns the otpauth:// URI + a QR (inline SVG). " \
                  "Not active until confirmed."
      response(200, "enrolment data") do
        schema type: :object, properties: {
          otpauth_uri: { type: :string, example: "otpauth://totp/Best%20Pinnacle%20Care:boss@bpc.test?secret=..." },
          qr_svg:      { type: :string, description: "Inline SVG of the QR code" }
        }
        let(:admin) { create(:admin, mfa_enabled: false) }
        let(:Authorization) { "Bearer #{jwt_for(admin, :admin)}" }
        run_test!
      end
    end
  end

  path "/api/v1/admin/mfa/confirm" do
    post("Confirm TOTP enrolment") do
      tags "MFA"
      consumes "application/json"
      produces "application/json"
      security [ bearerAuth: [] ]
      description "Verifies the first code, activates MFA, and returns one-time backup codes (shown once)."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { otp_code: { type: :string } }, required: %w[otp_code]
      }

      response(200, "MFA activated") do
        schema type: :object, properties: {
          mfa_enabled:  { type: :boolean },
          backup_codes: { type: :array, items: { type: :string } }
        }
        let(:admin) { create(:admin, mfa_enabled: false, mfa_secret: ROTP::Base32.random) }
        let(:Authorization) { "Bearer #{jwt_for(admin, :admin)}" }
        let(:body) { { otp_code: ROTP::TOTP.new(admin.mfa_secret).now } }
        run_test!
      end

      response(422, "invalid code") do
        schema "$ref" => "#/components/schemas/Error"
        let(:admin) { create(:admin, mfa_enabled: false, mfa_secret: ROTP::Base32.random) }
        let(:Authorization) { "Bearer #{jwt_for(admin, :admin)}" }
        let(:body) { { otp_code: "000000" } }
        run_test!
      end
    end
  end
end
