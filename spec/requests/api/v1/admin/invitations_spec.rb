require "rails_helper"

RSpec.describe "Invitations", type: :request do
  let(:rm)      { create(:admin, role: :registered_manager) }
  let(:rm_auth) { { "Authorization" => "Bearer #{jwt_for(rm, :admin)}" } }

  it "invites a carer who then accepts and logs in" do
    perform_enqueued_jobs do
      post "/api/v1/admin/employees",
           params: { email: "new@bpc.test", first_name: "New", last_name: "Carer", role: "carer" },
           headers: rm_auth, as: :json
    end
    expect(response).to have_http_status(:created)
    employee = Employee.find_by(email: "new@bpc.test")
    expect(employee.invited_at).to be_present

    token = ActionMailer::Base.deliveries.last.body.to_s[/token=([^\s&]+)/, 1]
    expect(token).to be_present

    put "/api/v1/staff/auth/password", params: { token: token, password: "newpass99" }, as: :json
    expect(response).to have_http_status(:no_content)
    expect(employee.reload.accepted_invite_at).to be_present

    post "/api/v1/staff/auth/login", params: { email: "new@bpc.test", password: "newpass99" }, as: :json
    expect(response).to have_http_status(:ok)
  end

  it "lets a manager invite carers but not office admins" do
    mgr = create(:admin, role: :manager)
    mgr_auth = { "Authorization" => "Bearer #{jwt_for(mgr, :admin)}" }

    post "/api/v1/admin/employees",
         params: { email: "c2@bpc.test", first_name: "C", last_name: "Two", role: "carer" }, headers: mgr_auth, as: :json
    expect(response).to have_http_status(:created)

    post "/api/v1/admin/admins",
         params: { email: "a2@bpc.test", first_name: "A", last_name: "Two", role: "coordinator" }, headers: mgr_auth, as: :json
    expect(response).to have_http_status(:forbidden)
  end

  it "lets a registered manager invite an office admin" do
    post "/api/v1/admin/admins",
         params: { email: "coord@bpc.test", first_name: "Co", last_name: "Ord", role: "coordinator" }, headers: rm_auth, as: :json
    expect(response).to have_http_status(:created)
    expect(Admin.find_by(email: "coord@bpc.test").invited_at).to be_present
  end
end
