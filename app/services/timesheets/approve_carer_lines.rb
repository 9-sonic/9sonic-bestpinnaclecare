module Timesheets
  # Approves one carer's lines within a period, independently of the rest of the
  # agency (additive to the period-wide ApprovePeriod). Same guard: a line whose
  # visit is still pending_review, or which was auto-closed, must be resolved
  # first. Idempotent — re-approving already-approved lines is a no-op.
  class ApproveCarerLines
    Result = Struct.new(:ok, :error, :approved_count, keyword_init: true)

    def self.call(period, employee, admin)
      return Result.new(ok: false, error: "period_locked") if period.locked?

      lines = period.timesheet_lines.where(employee_id: employee.id).includes(:visit_assignment)
      return Result.new(ok: false, error: "no_lines") if lines.empty?

      blocked = lines.any? { |l| l.flags.include?("auto_closed") || l.visit_assignment.pending_review? }
      return Result.new(ok: false, error: "unconfirmed_lines") if blocked

      count = 0
      lines.unapproved.each do |line|
        line.update!(approved_at: Time.current, approved_by: admin)
        count += 1
      end
      Result.new(ok: true, approved_count: count)
    end
  end
end
