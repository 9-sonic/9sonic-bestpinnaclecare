require "rails_helper"

RSpec.describe "Resend invite", type: :request do
  let(:manager) { create(:admin, role: "registered_manager") }
  let(:auth)    { { "Authorization" => "Bearer #{jwt_for(manager, :admin)}" } }

  describe "POST /api/v1/admin/employees/:id/resend_invite" do
    it "re-issues a fresh token and re-emails a pending carer" do
      carer = create(:employee, invited_at: 2.days.ago, accepted_invite_at: nil)
      old_digest = carer.reload.reset_password_token

      expect {
        perform_enqueued_jobs do
          post "/api/v1/admin/employees/#{carer.id}/resend_invite", headers: auth
        end
      }.to change { ActionMailer::Base.deliveries.size }.by(1)

      expect(response).to have_http_status(:ok)
      # A fresh token was set (invalidating the old link) and invited_at refreshed.
      expect(carer.reload.reset_password_token).not_to eq(old_digest)
      expect(carer.invited_at).to be > 1.hour.ago
    end

    it "422s for a carer who already accepted (not pending)" do
      carer = create(:employee, invited_at: 3.days.ago, accepted_invite_at: 1.day.ago)
      post "/api/v1/admin/employees/#{carer.id}/resend_invite", headers: auth
      expect(response).to have_http_status(:unprocessable_content)
      expect(response.parsed_body["error"]).to match(/already been accepted/i)
    end

    it "writes an employee.invite_resent audit event" do
      carer = create(:employee, invited_at: 1.day.ago, accepted_invite_at: nil)
      expect {
        post "/api/v1/admin/employees/#{carer.id}/resend_invite", headers: auth
      }.to change { Event.where(event_type: "employee.invite_resent").count }.by(1)
    end
  end

  describe "POST /api/v1/admin/admins/:id/resend_invite" do
    it "re-issues and re-emails a pending office user" do
      pending_admin = create(:admin, invited_at: 2.days.ago, accepted_invite_at: nil)
      expect {
        perform_enqueued_jobs do
          post "/api/v1/admin/admins/#{pending_admin.id}/resend_invite", headers: auth
        end
      }.to change { ActionMailer::Base.deliveries.size }.by(1)
      expect(response).to have_http_status(:ok)
    end

    it "422s for an already-accepted office user" do
      accepted = create(:admin, invited_at: 3.days.ago, accepted_invite_at: 1.day.ago)
      post "/api/v1/admin/admins/#{accepted.id}/resend_invite", headers: auth
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "is registered-manager only" do
      coordinator = create(:admin, role: "coordinator")
      pending_admin = create(:admin, invited_at: 1.day.ago, accepted_invite_at: nil)
      post "/api/v1/admin/admins/#{pending_admin.id}/resend_invite",
           headers: { "Authorization" => "Bearer #{jwt_for(coordinator, :admin)}" }
      expect(response).to have_http_status(:forbidden)
    end
  end
end
