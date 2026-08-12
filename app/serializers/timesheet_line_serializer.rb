class TimesheetLineSerializer
  def self.call(l)
    {
      id:                  l.id,
      timesheet_period_id: l.timesheet_period_id,
      employee_id:         l.employee_id,
      visit_assignment_id: l.visit_assignment_id,
      work_date:           l.work_date,
      scheduled_minutes:   l.scheduled_minutes,
      worked_minutes:      l.worked_minutes,
      break_minutes:       l.break_minutes,
      flags:               l.flags,
      approved_at:         l.approved_at&.iso8601,
      approved_by:         l.approved_by&.full_name
    }
  end
end
