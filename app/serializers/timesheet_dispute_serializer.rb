class TimesheetDisputeSerializer
  def self.call(d)
    {
      id:                    d.id,
      timesheet_line_id:     d.timesheet_line_id,
      raised_by_employee_id: d.raised_by_employee_id,
      # The office needs to see WHOSE dispute — include the carer, uniform with
      # every other employee object in the API.
      employee:              d.raised_by && {
        id: d.raised_by.id, first_name: d.raised_by.first_name,
        last_name: d.raised_by.last_name, full_name: d.raised_by.full_name
      },
      reason:                d.reason,
      state:                 d.state,
      resolution_note:       d.resolution_note,
      created_at:            d.created_at&.iso8601
    }
  end
end
