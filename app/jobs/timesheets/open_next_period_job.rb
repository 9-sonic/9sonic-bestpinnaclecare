module Timesheets
  # Ensures the next attendance period exists (rolls the window forward).
  class OpenNextPeriodJob < ApplicationJob
    queue_as :default

    def perform
      latest = TimesheetPeriod.order(:starts_on).last
      next_start = latest ? latest.ends_on + 1 : Date.current.beginning_of_week
      BuildPeriod.call(starts_on: next_start)
    end
  end
end
