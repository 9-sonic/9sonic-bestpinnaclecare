require "rails_helper"

RSpec.describe "Admin self-lockout guard", type: :request do
  let(:rm)   { create(:admin, role: :registered_manager) }
  let(:auth) { { "Authorization" => "Bearer #{jwt_for(rm, :admin)}" } }

  def patch_admin(id, attrs)
    patch "/api/v1/admin/admins/#{id}", params: attrs, headers: auth, as: :json
  end

  it "refuses to deactivate yourself" do
    patch_admin(rm.id, { active: false })
    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body["error"]).to eq("cannot_deactivate_self")
    expect(rm.reload.active).to be(true)
  end

  it "refuses to demote the last registered manager" do
    other = create(:admin, role: :registered_manager)
    # demote `other` while rm is still an RM -> allowed (rm remains)
    patch_admin(other.id, { role: "coordinator" })
    expect(response).to have_http_status(:ok)
    # now rm is the last RM; demoting rm -> blocked
    patch_admin(rm.id, { role: "manager" })
    expect(response).to have_http_status(:unprocessable_entity)
    expect(response.parsed_body["error"]).to eq("last_registered_manager")
  end

  it "allows demoting an RM when another active RM remains" do
    create(:admin, role: :registered_manager)
    target = create(:admin, role: :registered_manager)
    patch_admin(target.id, { role: "manager" })
    expect(response).to have_http_status(:ok)
    expect(target.reload.role).to eq("manager")
  end

  it "forbids a non-manager admin from managing admins at all" do
    auditor = create(:admin, role: :auditor)
    patch "/api/v1/admin/admins/#{rm.id}", params: { first_name: "X" },
          headers: { "Authorization" => "Bearer #{jwt_for(auditor, :admin)}" }, as: :json
    expect(response).to have_http_status(:forbidden)
  end
end
