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

  it "fails and blocks a tap outside the radius" do
    r = described_class.call(service_user: su, lat: 53.60, lng: -2.60)
    expect(r.result).to eq("fail")
    expect(r.blocked).to be(true)
    expect(r.distance_m).to be > 150
  end

  it "always blocks outside the radius regardless of any stored mode" do
    # The fence is on-site-only for everyone now; legacy warn/off modes on the
    # record are ignored — an outside tap is refused either way.
    %w[warn off block].each do |mode|
      r = described_class.call(service_user: su(mode: mode), lat: 53.60, lng: -2.60)
      expect(r.result).to eq("fail")
      expect(r.blocked).to be(true)
    end
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
