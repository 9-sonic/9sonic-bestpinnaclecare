module Timesheets
  # Approves a period, unless any line is unconfirmed (auto-closed or its visit is
  # still pending_review) — those must be resolved first (§6).
  class ApprovePeriod
    Result = Struct.new(:ok, :error, :period, keyword_init: true)

    def self.call(period, admin)
      blocked = period.timesheet_lines.includes(:visit_assignment).any? do |line|
        line.flags.include?("auto_closed") || line.visit_assignment.pending_review?
      end
      return Result.new(ok: false, error: "unconfirmed_lines") if blocked

      period.update!(status: "approved", approved_by: admin, approved_at: Time.current)
      Result.new(ok: true, period: period)
    end
  end
end
