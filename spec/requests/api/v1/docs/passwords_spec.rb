require "swagger_helper"

RSpec.describe "Password reset", type: :request do
  path "/api/v1/admin/auth/password" do
    post("Request a password reset") do
      tags "Auth — Admin"
      consumes "application/json"
      produces "application/json"
      description "Always returns 202 (no account enumeration). Emails a tokened reset link if the account exists. " \
                  "The same endpoints exist under /api/v1/staff/auth/password."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { email: { type: :string } }, required: %w[email]
      }
      response(202, "reset requested") do
        before { create(:admin, email: "boss@bestpinnacle.test") }
        let(:body) { { email: "boss@bestpinnacle.test" } }
        run_test!
      end
    end

    put("Set a new password") do
      tags "Auth — Admin"
      consumes "application/json"
      produces "application/json"
      description "Applies a new password using the token from the reset email."
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: { token: { type: :string }, password: { type: :string } },
        required: %w[token password]
      }
      response(204, "password changed") do
        let(:admin) { create(:admin) }
        let(:body) { { token: admin.send(:set_reset_password_token), password: "newpass99" } }
        run_test!
      end

      response(422, "invalid or expired token") do
        schema "$ref" => "#/components/schemas/Error"
        let(:body) { { token: "garbage", password: "newpass99" } }
        run_test!
      end
    end
  end
end
