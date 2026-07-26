class TimesheetPeriodSerializer
  def self.call(period, include_lines: false)
    payload = {
      id:          period.id,
      starts_on:   period.starts_on,
      ends_on:     period.ends_on,
      status:      period.status,
      approved_at: period.approved_at&.iso8601,
      locked_at:   period.locked_at&.iso8601
    }
    if include_lines
      payload[:lines] = period.timesheet_lines.includes(:employee).order(:work_date)
                              .map { |l| TimesheetLineSerializer.call(l) }
    end
    payload
  end
end
