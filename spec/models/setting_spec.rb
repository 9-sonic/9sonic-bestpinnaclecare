require "rails_helper"

RSpec.describe Setting, type: :model do
  describe ".instance" do
    # The global spec/support/settings.rb hook pre-creates the singleton before
    # every example, so to reproduce a genuinely fresh environment we must first
    # clear it. (Its very existence is why this bug was invisible to the suite.)
    before { Setting.delete_all }
    # Regression: on a fresh environment (no seed, e.g. after wiping everything
    # but the admin) the singleton is auto-created on first read. company_name is
    # NOT NULL with no DB default, so a bare first_or_create! raised
    # PG::NotNullViolation and 500'd every page that reads settings (rota, live
    # board, the geofence lookup at clock-in).
    it "creates the singleton row on an empty database without raising" do
      expect(Setting.count).to eq(0)
      expect { Setting.instance }.not_to raise_error
      expect(Setting.count).to eq(1)
    end

    it "supplies a non-null placeholder company_name on first create" do
      s = Setting.instance
      expect(s.company_name).to eq(Setting::DEFAULT_COMPANY_NAME)
      expect(s.company_name).to be_present
    end

    it "returns the same single row on subsequent calls (id is always 1)" do
      first = Setting.instance
      expect(Setting.instance.id).to eq(first.id)
      expect(Setting.instance.id).to eq(1)
      expect(Setting.count).to eq(1)
    end

    it "does not clobber an existing company_name" do
      Setting.instance.update!(company_name: "Best Pinnacle Care")
      expect(Setting.instance.company_name).to eq("Best Pinnacle Care")
    end
  end
end
