require "rails_helper"

RSpec.describe "Carer cover offers", type: :request do
  let(:manager)  { create(:admin, role: "registered_manager") }
  let(:admin_auth) { { "Authorization" => "Bearer #{jwt_for(manager, :admin)}" } }
  let(:su)       { create(:service_user) }
  let(:aisha)    { create(:employee) }
  let(:tom)      { create(:employee) }
  def carer_auth(e) = { "Authorization" => "Bearer #{jwt_for(e, :employee)}" }

  def open_visit
    create(:visit, service_user: su, status: "published",
                   scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now)
  end

  describe "broadcast → the carer sees it" do
    it "advertises an unfilled visit to every eligible carer" do
      v = open_visit
      aisha; tom # exist

      post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: v.id }, headers: admin_auth, as: :json
      expect(response).to have_http_status(:created)
      expect(response.parsed_body["offered"]).to eq(2)

      get "/api/v1/staff/cover_offers", headers: carer_auth(aisha)
      expect(response).to have_http_status(:ok)
      visit_ids = response.parsed_body.map { |o| o["visit"]["id"] }
      expect(visit_ids).to include(v.id)
    end

    it "notifies the carers in-app" do
      v = open_visit
      aisha
      expect {
        post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: v.id }, headers: admin_auth, as: :json
      }.to change { aisha.notifications.where(channel: "in_app").count }.by(1)
    end
  end

  describe "accepting" do
    it "lets a carer accept, filling the visit and creating their assignment" do
      v = open_visit
      aisha; tom
      post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: v.id }, headers: admin_auth, as: :json
      offer = CoverOffer.find_by(visit: v, employee: aisha)

      post "/api/v1/staff/cover_offers/#{offer.id}/accept", headers: carer_auth(aisha)
      expect(response).to have_http_status(:ok)
      expect(VisitAssignment.where(visit: v, employee: aisha, assignment_status: "assigned")).to exist
      expect(offer.reload.state).to eq("accepted")
    end

    it "first-come: when one carer accepts, the visit fills and the others' offers are withdrawn" do
      v = open_visit
      aisha; tom
      post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: v.id }, headers: admin_auth, as: :json
      aisha_offer = CoverOffer.find_by(visit: v, employee: aisha)
      tom_offer   = CoverOffer.find_by(visit: v, employee: tom)

      post "/api/v1/staff/cover_offers/#{aisha_offer.id}/accept", headers: carer_auth(aisha)
      expect(response).to have_http_status(:ok)

      # Tom's offer is retired…
      expect(tom_offer.reload.state).to eq("withdrawn")
      # …and if Tom tries anyway, he's told it's taken, with no second assignment.
      post "/api/v1/staff/cover_offers/#{tom_offer.id}/accept", headers: carer_auth(tom)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(VisitAssignment.where(visit: v, assignment_status: "assigned").count).to eq(1)
    end

    it "lets a carer accept an offer that overlaps a visit they're already on" do
      # Aisha is already assigned to an overlapping visit; she is still offered
      # this one, and may still take it — carers may double up across clients.
      other = create(:visit, service_user: create(:service_user), status: "published",
                             scheduled_start: 2.hours.from_now, scheduled_end: 3.hours.from_now)
      VisitAssignment.create!(visit: other, employee: aisha, assignment_status: "assigned", lifecycle_state: :scheduled)

      v = open_visit
      aisha; tom
      post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: v.id }, headers: admin_auth, as: :json
      offer = CoverOffer.find_by(visit: v, employee: aisha)
      expect(offer).to be_present # a clash no longer withholds the offer

      post "/api/v1/staff/cover_offers/#{offer.id}/accept", headers: carer_auth(aisha)
      expect(response).to have_http_status(:ok)
      expect(aisha.visit_assignments.assigned.count).to eq(2)
    end

    it "won't let a carer accept an offer that isn't theirs" do
      v = open_visit
      aisha; tom
      post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: v.id }, headers: admin_auth, as: :json
      aisha_offer = CoverOffer.find_by(visit: v, employee: aisha)

      post "/api/v1/staff/cover_offers/#{aisha_offer.id}/accept", headers: carer_auth(tom)
      expect(response).to have_http_status(:not_found)
    end
  end

  describe "declining" do
    it "lets a carer decline their offer" do
      v = open_visit
      aisha; tom
      post "/api/v1/admin/cover_offers/broadcast", params: { visit_id: v.id }, headers: admin_auth, as: :json
      offer = CoverOffer.find_by(visit: v, employee: aisha)

      post "/api/v1/staff/cover_offers/#{offer.id}/decline", headers: carer_auth(aisha)
      expect(response).to have_http_status(:ok)
      expect(offer.reload.state).to eq("declined")

      # Declined offers drop off the carer's list.
      get "/api/v1/staff/cover_offers", headers: carer_auth(aisha)
      expect(response.parsed_body.map { |o| o["id"] }).not_to include(offer.id)
    end
  end
end
