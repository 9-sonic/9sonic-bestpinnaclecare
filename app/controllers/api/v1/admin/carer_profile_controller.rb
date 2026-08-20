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
          # Same per-carer metrics the employees list shows (hours this week,
          # 30-day punctuality, usual capture method), merged onto the profile.
          stats = ::Staff::Stats.call(only: e.id)[e.id] || {}
          render json: {
            employee: EmployeeSerializer.call(e).merge(stats),
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

        # Each of the four record lists (visits / notes / clock / mileage) is a
        # dated activity stream and takes the SAME filters so the office can reach
        # any record from any point in history — not just the first page:
        #   ?from=&to=            date range (against that stream's own date column)
        #   ?service_user_id=     only records tied to that client
        #   ?q=                   free-text (notes body; request summary/detail)
        # Requests carry no client, so they ignore service_user_id.

        # GET /admin/employees/:employee_id/visits
        def visits
          scope = filter_client(apply_range(assignments_scope(employee), "visits.scheduled_start"), "visits.service_user_id")
          paginate(scope) { |va| VisitAssignmentSerializer.call(va, include_service_user: true) }
        end

        # GET /admin/employees/:employee_id/notes  — every note this carer wrote.
        def notes
          scope = filter_client(apply_range(notes_scope(employee), "visit_notes.created_at"), "visits.service_user_id")
          scope = scope.where("visit_notes.body ILIKE ?", "%#{sanitize_like(params[:q])}%") if params[:q].present?
          paginate(scope) { |n| note_json(n) }
        end

        # GET /admin/employees/:employee_id/clock_events  — their clock history.
        def clock_events
          scope = filter_client(apply_range(clock_scope(employee), "clock_events.occurred_at"), "visits.service_user_id")
          paginate(scope) { |ce| clock_json(ce) }
        end

        # GET /admin/employees/:employee_id/requests  — all their requests.
        def requests
          scope = apply_range(employee.carer_requests.order(created_at: :desc), "carer_requests.created_at")
          if params[:q].present?
            like = "%#{sanitize_like(params[:q])}%"
            scope = scope.where("carer_requests.summary ILIKE :q OR carer_requests.detail ILIKE :q", q: like)
          end
          paginate(scope) { |r| CarerRequestSerializer.call(r) }
        end

        # GET /admin/employees/:employee_id/mileage  — their travel claims.
        def mileage
          scope = employee.mileage_claims.includes(visit_assignment: { visit: :service_user })
                          .order(travel_date: :desc)
          scope = apply_range(scope, "mileage_claims.travel_date")
          if params[:service_user_id].present?
            scope = scope.joins(visit_assignment: :visit).where(visits: { service_user_id: params[:service_user_id] })
          end
          paginate(scope) { |m| mileage_json(m) }
        end

        private

        def employee = @employee ||= Employee.find(params[:employee_id])

        # Apply ?from=/?to= against the given (fully-qualified) column. Bad dates
        # are ignored rather than 500ing.
        def apply_range(scope, column)
          from = safe_date(params[:from])
          to   = safe_date(params[:to])
          scope = scope.where("#{column} >= ?", from.beginning_of_day) if from
          scope = scope.where("#{column} <= ?", to.end_of_day) if to
          scope
        end

        # Restrict to one client. Streams that already join visits pass the visits
        # column; the caller guarantees the join exists.
        def filter_client(scope, column)
          return scope if params[:service_user_id].blank?
          scope.where("#{column} = ?", params[:service_user_id])
        end

        def safe_date(str)
          str.present? ? Date.parse(str.to_s) : nil
        rescue ArgumentError, TypeError
          nil
        end

        def sanitize_like(str)
          ActiveRecord::Base.sanitize_sql_like(str.to_s)
        end

        def assignments_scope(e)
          e.visit_assignments.assigned.includes(visit: :service_user)
           .joins(:visit).order("visits.scheduled_start DESC")
        end

        # Notes this carer authored (VisitNote author is polymorphic Employee|Admin).
        # Joins visits so notes can be filtered by client and by care date.
        def notes_scope(e)
          VisitNote.effective.where(author_type: "Employee", author_id: e.id)
                   .joins(visit_assignment: :visit)
                   .includes(visit_assignment: { visit: :service_user }).order(created_at: :desc)
        end

        def clock_scope(e)
          ClockEvent.joins(visit_assignment: :visit)
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

        # A mileage claim may be tied to a visit (its client gives context) or be
        # a standalone carer claim (nil visit_assignment) — handle both.
        def mileage_json(m)
          su = m.visit_assignment&.visit&.service_user
          MileageClaimSerializer.call(m).merge(service_user: su&.full_name)
        end

        # Shared pagination: ?page=&per_page= -> { items:, page:, per_page:, total: }.
        def paginate(scope)
          page     = [ params.fetch(:page, 1).to_i, 1 ].max
          per_page = params.fetch(:per_page, PER_PAGE).to_i.clamp(1, 100)
          total    = scope.count
          items    = scope.offset((page - 1) * per_page).limit(per_page).map { |r| yield r }
          render json: { items: items, page: page, per_page: per_page, total: total }
        end
      end
    end
  end
end
