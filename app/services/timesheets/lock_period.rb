module Timesheets
  class LockPeriod
    def self.call(period, _admin)
      period.update!(status: "locked", locked_at: Time.current)
      period
    end
  end
end
