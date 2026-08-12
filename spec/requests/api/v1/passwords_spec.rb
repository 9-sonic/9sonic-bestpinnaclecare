require "rails_helper"

RSpec.describe "Password reset", type: :request do
  let!(:admin) { create(:admin, email: "boss@bpc.test", password: "secret12", mfa_enabled: false) }

  it "emails a reset link and lets the admin set a new password" do
    perform_enqueued_jobs do
      post "/api/v1/admin/auth/password", params: { email: "boss@bpc.test" }, as: :json
    end
    expect(response).to have_http_status(:accepted)

    mail = ActionMailer::Base.deliveries.last
    expect(mail.to).to eq([ "boss@bpc.test" ])
    # Read the decoded text part — the mail is multipart (text + html).
    body = (mail.text_part || mail).body.decoded
    token = body[/token=([^\s&]+)/, 1]
    expect(token).to be_present

    put "/api/v1/admin/auth/password", params: { token: token, password: "newpass99" }, as: :json
    expect(response).to have_http_status(:no_content)

    post "/api/v1/admin/auth/login", params: { email: "boss@bpc.test", password: "newpass99" }, as: :json
    expect(response).to have_http_status(:ok)

    post "/api/v1/admin/auth/login", params: { email: "boss@bpc.test", password: "secret12" }, as: :json
    expect(response).to have_http_status(:unauthorized)
  end

  it "does not reveal unknown emails and sends nothing" do
    expect {
      perform_enqueued_jobs do
        post "/api/v1/admin/auth/password", params: { email: "ghost@bpc.test" }, as: :json
      end
    }.not_to change { ActionMailer::Base.deliveries.size }
    expect(response).to have_http_status(:accepted)
  end

  it "rejects a bad reset token" do
    put "/api/v1/admin/auth/password", params: { token: "garbage", password: "newpass99" }, as: :json
    expect(response).to have_http_status(422)
  end
end
