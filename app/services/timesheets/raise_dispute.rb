module Timesheets
  class RaiseDispute
    def self.call(line:, employee:, reason:)
      raise ActiveRecord::RecordNotFound unless line.employee_id == employee.id

      TimesheetDispute.create!(timesheet_line: line, raised_by: employee, reason: reason, state: "open")
    end
  end
end
