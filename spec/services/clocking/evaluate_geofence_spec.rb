require "rails_helper"

RSpec.describe Clocking::EvaluateGeofence, type: :model do
  def su(mode: nil, lat: 53.4808, lng: -2.2426)
    create(:service_user, lat: lat, lng: lng, geofence_mode: mode, geofence_radius_m: 150)
  end

  it "passes within the radius" do
    r = described_class.call(service_user: su, lat: 53.4808, lng: -2.2426)
    expect(r.result).to eq("pass")
    expect(r.blocked).to be(false)
    expect(r.distance_m).to be <= 150
  end

  it "fails and blocks outside the radius in block mode" do
    r = described_class.call(service_user: su, lat: 53.60, lng: -2.60)
    expect(r.result).to eq("fail")
    expect(r.blocked).to be(true)
    expect(r.distance_m).to be > 150
  end

  it "fails but does NOT block in warn mode" do
    r = described_class.call(service_user: su(mode: "warn"), lat: 53.60, lng: -2.60)
    expect(r.result).to eq("fail")
    expect(r.blocked).to be(false)
  end

  it "is not_checked (allowed) in off mode" do
    r = described_class.call(service_user: su(mode: "off"), lat: 53.60, lng: -2.60)
    expect(r.result).to eq("not_checked")
    expect(r.blocked).to be(false)
  end

  it "is no_fix when the device sends no coordinates" do
    r = described_class.call(service_user: su, lat: nil, lng: nil)
    expect(r.result).to eq("no_fix")
    expect(r.blocked).to be(false)
  end

  it "is not_checked when the home has no coordinates" do
    r = described_class.call(service_user: su(lat: nil, lng: nil), lat: 53.48, lng: -2.24)
    expect(r.result).to eq("not_checked")
  end
end
