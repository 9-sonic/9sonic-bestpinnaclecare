require "rails_helper"

# Scaffold smoke test: proves the Rails API app boots under the test env and
# can reach PostgreSQL through the configured adapter. Safe to delete once real
# specs exist.
RSpec.describe "application scaffold", type: :model do
  it "boots in the test environment" do
    expect(Rails.env).to eq("test")
  end

  it "runs API-only" do
    expect(Rails.application.config.api_only).to be(true)
  end

  it "connects to PostgreSQL" do
    expect(ActiveRecord::Base.connection.adapter_name).to eq("PostgreSQL")
  end
end
