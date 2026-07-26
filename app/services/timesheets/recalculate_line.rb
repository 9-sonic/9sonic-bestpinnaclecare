module Timesheets
  class RecalculateLine
    def self.call(line)
      BuildPeriod.apply(line, line.visit_assignment)
      line.save!
      line
    end
  end
end
