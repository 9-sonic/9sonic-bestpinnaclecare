module Timesheets
  class RecalculateJob < ApplicationJob
    queue_as :default

    def perform(period_id)
      BuildPeriod.rebuild_lines(TimesheetPeriod.find(period_id))
    end
  end
end
