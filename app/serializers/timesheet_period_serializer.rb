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
      lines = period.timesheet_lines.includes(:employee, :approved_by).order(:work_date).to_a
      payload[:lines] = lines.map { |l| TimesheetLineSerializer.call(l) }
      # Per-carer approval rollup so the office can approve/track one carer at a
      # time: each carer with their line count and how many are approved.
      payload[:carers] = lines.group_by(&:employee_id).map do |employee_id, ls|
        {
          employee_id:    employee_id,
          employee_name:  ls.first.employee.full_name,
          line_count:     ls.size,
          approved_count: ls.count(&:approved?),
          approved:       ls.all?(&:approved?)
        }
      end.sort_by { |c| c[:employee_name] }
    end
    payload
  end
end
