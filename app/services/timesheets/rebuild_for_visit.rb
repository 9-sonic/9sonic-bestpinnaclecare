module Timesheets
  # After an attendance change (a clock correction), rebuild the timesheet line
  # for the affected visit so pay reflects the corrected hours — instead of the
  # stale snapshot BuildPeriod captured earlier.
  #
  # Skips a LOCKED period (pay already exported/final): the correction is still
  # recorded in the attendance record, but the locked line is not silently
  # rewritten — returns :locked so the caller can flag it for re-approval.
  class RebuildForVisit
    def self.call(visit_assignment, settings: Setting.instance)
      date = visit_assignment.visit&.scheduled_start&.to_date
      return :no_date unless date

      # The visit falls in the built period whose window covers its date. Find it
      # by range rather than reconstructing the alignment — the period was already
      # created by BuildPeriod, so we just locate and refresh it.
      period = TimesheetPeriod.where("starts_on <= :d AND ends_on >= :d", d: date).order(starts_on: :desc).first
      return :not_built unless period
      return :locked if period.locked?

      BuildPeriod.rebuild_lines(period, settings.timesheet_rounding_minutes.to_i)
      :rebuilt
    end
  end
end
