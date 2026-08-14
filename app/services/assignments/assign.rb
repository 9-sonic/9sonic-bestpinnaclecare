module Assignments
  # The single, race-safe way to put a carer on a visit. Locks the employee's
  # active assignments FOR UPDATE inside the transaction, THEN re-checks for a
  # time overlap, THEN creates — so two concurrent assigns of the same carer to
  # overlapping visits can't both pass the check (the second waits on the lock
  # and then sees the first). Used by admin assign, reassign and cover-accept.
  #
  # Returns a Result: ok + assignment, or blocked + conflict.
  Result = Struct.new(:ok, :assignment, :conflict, keyword_init: true)

  class Assign
    def self.call(visit:, employee:, assigned_by:, withdraw: nil)
      ActiveRecord::Base.transaction do
        # Serialise concurrent assigns for THIS carer: the lock makes a second
        # request wait here until the first commits, so its re-check sees it.
        employee.visit_assignments.assigned.lock("FOR UPDATE").load

        clash = Validate.conflicting_visit(visit: visit, employee: employee)
        if clash
          return Result.new(ok: false, conflict: clash)
        end

        withdraw&.update!(assignment_status: "withdrawn", lifecycle_state: :cancelled)
        va = VisitAssignment.create!(visit: visit, employee: employee, assigned_by: assigned_by)
        Result.new(ok: true, assignment: va)
      end
    end
  end
end
