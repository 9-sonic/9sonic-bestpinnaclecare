class TimesheetDisputeSerializer
  def self.call(d)
    {
      id:                    d.id,
      timesheet_line_id:     d.timesheet_line_id,
      raised_by_employee_id: d.raised_by_employee_id,
      reason:                d.reason,
      state:                 d.state,
      resolution_note:       d.resolution_note,
      created_at:            d.created_at&.iso8601
    }
  end
end
