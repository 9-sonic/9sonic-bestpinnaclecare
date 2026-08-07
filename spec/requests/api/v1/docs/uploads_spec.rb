require "swagger_helper"

# Avatar uploads for both identities (multipart). Message file attachments are
# sent as multipart on POST .../messages (files[]); covered behaviourally in
# spec/requests/api/v1/uploads_spec.rb.
RSpec.describe "File uploads", type: :request do
  let(:png) { Rack::Test::UploadedFile.new(Rails.root.join("spec/fixtures/files/avatar.png"), "image/png") }

  path "/api/v1/staff/me/avatar" do
    post("Upload your avatar (carer)") do
      tags "Carer"; consumes "multipart/form-data"; produces "application/json"; security [ bearerAuth: [] ]
      description "PNG/JPEG/WebP/GIF, up to 5 MB. 422 { error: 'unsupported_type' | 'too_large' | 'no_file' } otherwise."
      parameter name: :avatar, in: :formData, schema: { type: :string, format: :binary }, required: true
      let(:employee) { create(:employee) }
      let(:Authorization) { "Bearer #{jwt_for(employee, :employee)}" }
      let(:avatar) { png }
      response(200, "updated profile") { schema "$ref" => "#/components/schemas/Employee"; run_test! }
    end

    delete("Remove your avatar (carer)") do
      tags "Carer"; produces "application/json"; security [ bearerAuth: [] ]
      let(:employee) { create(:employee) }
      let(:Authorization) { "Bearer #{jwt_for(employee, :employee)}" }
      response(200, "removed") { schema "$ref" => "#/components/schemas/Employee"; run_test! }
    end
  end

  path "/api/v1/admin/me/avatar" do
    post("Upload your avatar (office)") do
      tags "Office — People"; consumes "multipart/form-data"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :avatar, in: :formData, schema: { type: :string, format: :binary }, required: true
      let(:manager) { create(:admin, role: :registered_manager) }
      let(:Authorization) { "Bearer #{jwt_for(manager, :admin)}" }
      let(:avatar) { png }
      response(200, "updated") { schema "$ref" => "#/components/schemas/Admin"; run_test! }
    end
  end

  path "/api/v1/admin/employees/{id}/avatar" do
    parameter name: :id, in: :path, type: :integer
    post("Set a carer's avatar (office)") do
      tags "Office — People"; consumes "multipart/form-data"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :avatar, in: :formData, schema: { type: :string, format: :binary }, required: true
      let(:manager) { create(:admin, role: :registered_manager) }
      let(:Authorization) { "Bearer #{jwt_for(manager, :admin)}" }
      let(:id) { create(:employee).id }
      let(:avatar) { png }
      response(200, "updated") { schema "$ref" => "#/components/schemas/Employee"; run_test! }
    end
  end
end
