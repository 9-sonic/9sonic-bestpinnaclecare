module Assignments
  # The single, race-safe way to put a carer on a visit. Locks the employee's
  # active assignments FOR UPDATE inside the transaction, THEN re-checks for a
  # time overlap, THEN creates — so two concurrent assigns of the same carer to
  # overlapping visits can't both pass the check (the second waits on the lock
  # and then sees the first). Used by admin assign, reassign and cover-accept.
  #
  # Returns a Result: ok + assignment, or blocked + conflict.
  # reason: :carer     -> the carer is already booked in an overlapping visit
  # reason: :client    -> the client already has a SEPARATE overlapping visit
  #                       (a double-up on the SAME visit is fine — that's excluded)
  # reason: :duplicate -> this carer is already on THIS visit
  Result = Struct.new(:ok, :assignment, :conflict, :reason, keyword_init: true)

  class Assign
    def self.call(visit:, employee:, assigned_by:, withdraw: nil)
      ActiveRecord::Base.transaction do
        # Serialise concurrent assigns for THIS carer: the lock makes a second
        # request wait here until the first commits, so its re-check sees it.
        employee.visit_assignments.assigned.lock("FOR UPDATE").load
        # Same for THIS client's assignments, so two carers can't be booked onto
        # the same service user at once under a race.
        VisitAssignment.assigned.joins(:visit)
                       .where(visits: { service_user_id: visit.service_user_id })
                       .lock("FOR UPDATE").load

        # Already on THIS visit? (A double-up visit takes several carers, so we
        # can't rely on "the visit is full" — guard the exact pair.) Return a
        # clean result instead of letting the (visit_id, employee_id) unique index
        # raise an unhandled 500.
        if visit.visit_assignments.assigned.exists?(employee_id: employee.id)
          return Result.new(ok: false, reason: :duplicate)
        end

        if (clash = Validate.conflicting_visit(visit: visit, employee: employee))
          return Result.new(ok: false, conflict: clash, reason: :carer)
        end
        # One service user, one carer at a time — block a second carer overlapping
        # the client's existing visit. The visit being reassigned is excluded, so
        # swapping the carer on the SAME visit is fine.
        if (clash = Validate.client_conflict(visit: visit))
          # A reassignment withdraws the old assignment first, so its own visit
          # never counts as a clash; but guard against the withdraw target too.
          unless withdraw && clash.visit_id == withdraw.visit_id
            return Result.new(ok: false, conflict: clash, reason: :client)
          end
        end

        withdraw&.update!(assignment_status: "withdrawn", lifecycle_state: :cancelled)
        va = VisitAssignment.create!(visit: visit, employee: employee, assigned_by: assigned_by)
        Result.new(ok: true, assignment: va)
      end
    end
  end
end
