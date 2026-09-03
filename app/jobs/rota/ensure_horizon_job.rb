module Rota
  # Daily (SolidQueue recurring) top-up of the rolling rota horizon: regenerates
  # and publishes the weekly template out to ~52 weeks ahead, so the office always
  # has a full year of unassigned visits to staff and it never runs dry.
  # Idempotent — see Visits::EnsureHorizon.
  class EnsureHorizonJob < ApplicationJob
    queue_as :default

    def perform(weeks: 52)
      Visits::EnsureHorizon.call(weeks: weeks)
    end
  end
end
