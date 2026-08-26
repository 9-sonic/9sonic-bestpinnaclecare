require "rails_helper"

# The office-wide care-notes journal: filter every visit note by carer AND client
# together, plus date range and free text, and export the filtered set as PDF or
# Word. The list and both exports share one filtered scope (Notes::Query), so
# these specs assert the filter once and trust the export streams the same rows.
RSpec.describe "Admin care notes", type: :request do
  let(:admin) { create(:admin) }
  let(:auth)  { { "Authorization" => "Bearer #{jwt_for(admin, :admin)}" } }

  let(:jane)  { create(:service_user) }
  let(:smith) { create(:service_user) }
  let(:ada)   { create(:employee) }
  let(:ben)   { create(:employee) }

  # A note by `carer` for `client`, on a visit at `at`.
  def note!(carer:, client:, at:, body:)
    visit = create(:visit, service_user: client, scheduled_start: at, scheduled_end: at + 1.hour)
    va    = create(:visit_assignment, visit: visit, employee: carer)
    VisitNote.create!(visit_assignment: va, author: carer, body: body, client_note_id: SecureRandom.uuid)
  end

  before do
    note!(carer: ada, client: jane,  at: 2.days.ago,  body: "Ada visited Jane — ate well.")
    note!(carer: ada, client: smith, at: 3.days.ago,  body: "Ada visited Smith — refused lunch.")
    note!(carer: ben, client: jane,  at: 10.days.ago, body: "Ben visited Jane last week.")
  end

  describe "GET /api/v1/admin/notes" do
    it "returns every note, newest first, with carer + client resolved" do
      get "/api/v1/admin/notes", headers: auth
      expect(response).to have_http_status(:ok)
      body = response.parsed_body
      expect(body["total"]).to eq(3)
      first = body["items"].first
      expect(first).to include("employee_name" => ada.full_name, "service_user_name" => jane.full_name)
      expect(first["body"]).to eq("Ada visited Jane — ate well.")
    end

    it "filters by carer AND client together" do
      get "/api/v1/admin/notes", params: { employee_id: ada.id, service_user_id: jane.id }, headers: auth
      bodies = response.parsed_body["items"].map { |n| n["body"] }
      expect(bodies).to eq([ "Ada visited Jane — ate well." ])
    end

    it "filters by carer alone" do
      get "/api/v1/admin/notes", params: { employee_id: ada.id }, headers: auth
      expect(response.parsed_body["total"]).to eq(2)
    end

    it "filters by free text on the body" do
      get "/api/v1/admin/notes", params: { q: "refused" }, headers: auth
      expect(response.parsed_body["items"].map { |n| n["body"] }).to eq([ "Ada visited Smith — refused lunch." ])
    end

    it "filters by date range on the visit" do
      get "/api/v1/admin/notes", params: { from: 5.days.ago.to_date.iso8601 }, headers: auth
      # Excludes the 10-day-old note.
      expect(response.parsed_body["total"]).to eq(2)
    end

    it "rejects an unauthenticated caller" do
      get "/api/v1/admin/notes"
      expect(response).to have_http_status(:unauthorized)
    end
  end

  describe "GET /api/v1/admin/notes_exports" do
    it "streams a real PDF for the filtered notes" do
      get "/api/v1/admin/notes_exports", params: { format: "pdf", employee_id: ada.id }, headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("application/pdf")
      expect(response.headers["Content-Disposition"]).to include("care-notes-").and include(".pdf")
      expect(response.body[0, 4]).to eq("%PDF")
    end

    it "streams a real .docx (valid zip) for the filtered notes" do
      get "/api/v1/admin/notes_exports", params: { format: "docx", service_user_id: jane.id }, headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.media_type).to eq("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
      expect(response.headers["Content-Disposition"]).to include(".docx")
      expect(response.body[0, 2]).to eq("PK") # zip local-file-header magic
    end

    it "defaults to PDF when the format is missing or unknown" do
      get "/api/v1/admin/notes_exports", params: { format: "xls" }, headers: auth
      expect(response.media_type).to eq("application/pdf")
    end

    it "still produces a valid file when nothing matches the filters" do
      get "/api/v1/admin/notes_exports", params: { format: "pdf", q: "no-such-text-anywhere" }, headers: auth
      expect(response).to have_http_status(:ok)
      expect(response.body[0, 4]).to eq("%PDF")
    end
  end
end
