module Timesheets
  # Finds/creates the attendance period starting on a date (length from settings)
  # and (re)builds its lines from completed/pending visits in the window.
  # Overnight visits are attributed to the shift START date. Idempotent.
  class BuildPeriod
    LENGTHS = { "weekly" => 7, "fortnightly" => 14, "four_weekly" => 28 }.freeze

    def self.call(starts_on:, settings: Setting.instance)
      starts_on = starts_on.to_date
      ends_on   = starts_on + (LENGTHS.fetch(settings.timesheet_period, 7) - 1)
      period = TimesheetPeriod.find_or_create_by!(starts_on: starts_on) { |p| p.ends_on = ends_on }
      rebuild_lines(period)
      period
    end

    def self.rebuild_lines(period)
      range = period.starts_on.beginning_of_day..period.ends_on.end_of_day
      VisitAssignment.where(lifecycle_state: %i[completed pending_review])
                     .joins(:visit).where(visits: { scheduled_start: range })
                     .includes(:visit).find_each do |va|
        line = period.timesheet_lines.find_or_initialize_by(visit_assignment_id: va.id)
        apply(line, va)
        line.save!
      end
    end

    # Copies the (attendance) figures from a visit assignment onto a line.
    def self.apply(line, va)
      visit = va.visit
      line.employee_id       = va.employee_id
      line.work_date         = visit.scheduled_start.to_date
      line.scheduled_minutes = ((visit.scheduled_end - visit.scheduled_start) / 60).round
      line.worked_minutes    = va.worked_minutes || 0
      line.break_minutes     = 0
      line.flags             = va.flags
    end
  end
end
