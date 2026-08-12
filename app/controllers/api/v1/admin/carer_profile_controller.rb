module Api
  module V1
    module Admin
      # The carer 360: everything the office may need to see about one carer —
      # their visits, the notes they wrote, their clock history, timesheet lines
      # and requests. The profile action returns a summary + recent slices; the
      # heavy lists have their own paginated endpoints so a long history never
      # lands in one response.
      #
      # Nested under /admin/employees/:employee_id.
      class CarerProfileController < BaseController
        PER_PAGE = 50

        # GET /admin/employees/:employee_id/profile
        def profile
          e = employee
          render json: {
            employee: EmployeeSerializer.call(e),
            counts: {
              visits:        e.visit_assignments.assigned.count,
              upcoming:      e.visit_assignments.assigned.non_terminal.count,
              notes:         notes_scope(e).count,
              open_requests: e.carer_requests.pending.count
            },
            recent_visits:   assignments_scope(e).limit(5).map { |va| VisitAssignmentSerializer.call(va, include_service_user: true) },
            recent_notes:    notes_scope(e).limit(5).map { |n| note_json(n) },
            recent_clock:    clock_scope(e).limit(5).map { |ce| clock_json(ce) },
            open_requests:   e.carer_requests.pending.order(created_at: :desc).map { |r| CarerRequestSerializer.call(r) }
          }
        end

        # GET /admin/employees/:employee_id/visits
        def visits
          paginate(assignments_scope(employee)) { |va| VisitAssignmentSerializer.call(va, include_service_user: true) }
        end

        # GET /admin/employees/:employee_id/notes  — every note this carer wrote.
        def notes
          paginate(notes_scope(employee)) { |n| note_json(n) }
        end

        # GET /admin/employees/:employee_id/clock_events  — their clock history.
        def clock_events
          paginate(clock_scope(employee)) { |ce| clock_json(ce) }
        end

        # GET /admin/employees/:employee_id/timesheet_lines
        def timesheet_lines
          paginate(employee.timesheet_lines.order(work_date: :desc)) { |l| TimesheetLineSerializer.call(l) }
        end

        # GET /admin/employees/:employee_id/requests  — all their requests.
        def requests
          paginate(employee.carer_requests.order(created_at: :desc)) { |r| CarerRequestSerializer.call(r) }
        end

        private

        def employee = @employee ||= Employee.find(params[:employee_id])

        def assignments_scope(e)
          e.visit_assignments.assigned.includes(visit: :service_user)
           .joins(:visit).order("visits.scheduled_start DESC")
        end

        # Notes this carer authored (VisitNote author is polymorphic Employee|Admin).
        def notes_scope(e)
          VisitNote.effective.where(author_type: "Employee", author_id: e.id)
                   .includes(visit_assignment: { visit: :service_user }).order(created_at: :desc)
        end

        def clock_scope(e)
          ClockEvent.joins(:visit_assignment)
                    .where(visit_assignments: { employee_id: e.id })
                    .includes(visit_assignment: { visit: :service_user })
                    .order(occurred_at: :desc)
        end

        def note_json(n)
          va = n.visit_assignment
          VisitNoteSerializer.call(n).merge(
            visit_id: va.visit_id,
            service_user: va.visit.service_user&.full_name,
            visit_scheduled_start: va.visit.scheduled_start&.iso8601
          )
        end

        def clock_json(ce)
          va = ce.visit_assignment
          ClockEventSerializer.call(ce).merge(
            visit_id: va.visit_id,
            service_user: va.visit.service_user&.full_name
          )
        end

        # Shared pagination: ?page=&per_page= -> { items:, page:, per_page:, total: }.
        def paginate(scope)
          page     = [params.fetch(:page, 1).to_i, 1].max
          per_page = params.fetch(:per_page, PER_PAGE).to_i.clamp(1, 100)
          total    = scope.count
          items    = scope.offset((page - 1) * per_page).limit(per_page).map { |r| yield r }
          render json: { items: items, page: page, per_page: per_page, total: total }
        end
      end
    end
  end
end
