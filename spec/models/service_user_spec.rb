require "rails_helper"

RSpec.describe ServiceUser, type: :model do
  it "geocodes the home address to lat/lng when coords are missing" do
    su = ServiceUser.create!(first_name: "Ada", last_name: "Smith",
                             address_line1: "1 High St", city: "Manchester", postcode: "M1 1AA")
    expect(su.lat.to_f).to eq(53.4808)
    expect(su.lng.to_f).to eq(-2.2426)
  end

  it "does not overwrite admin-provided coordinates" do
    su = ServiceUser.create!(first_name: "Bob", last_name: "Jones",
                             address_line1: "2 Low St", postcode: "M2 2BB", lat: 51.5, lng: -0.1)
    expect(su.lat.to_f).to eq(51.5)
    expect(su.lng.to_f).to eq(-0.1)
  end

  it "does not geocode when there is no address" do
    su = ServiceUser.create!(first_name: "Cy", last_name: "No")
    expect(su.lat).to be_nil
  end
end
