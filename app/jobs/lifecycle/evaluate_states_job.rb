module Lifecycle
  # Runs every minute (SolidQueue recurring) to advance non-terminal visits.
  class EvaluateStatesJob < ApplicationJob
    queue_as :default

    def perform
      VisitAssignment.assigned.non_terminal.includes(:visit).find_each do |va|
        EvaluateAssignment.call(va)
      end
    end
  end
end
