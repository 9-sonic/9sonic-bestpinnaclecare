module Api
  module V1
    module Staff
      # One visit for the Shift Detail screen: assignment + service user + care
      # plan + task checklist + notes.
      class VisitAssignmentsController < BaseController
        before_action :set_assignment

        # GET /api/v1/staff/visit_assignments/:id
        def show
          ensure_tasks!
          render json: detail
        end

        # PATCH /api/v1/staff/visit_assignments/:id/tasks  { tasks: [ { id, done } ] }
        def update_tasks
          (params.permit(tasks: %i[id done])[:tasks] || []).each do |t|
            task = @va.visit_tasks.find_by(id: t[:id])
            task&.update!(done: t[:done], completed_at: (t[:done] ? Time.current : nil))
          end
          render json: @va.visit_tasks.map { |vt| VisitTaskSerializer.call(vt) }
        end

        # POST /api/v1/staff/visit_assignments/:id/note  { body, client_note_id, supersedes_id? }
        def create_note
          note = VisitNote.create!(
            visit_assignment: @va, author: current_employee, body: params.require(:body),
            client_note_id: params[:client_note_id].presence || SecureRandom.uuid, supersedes_id: params[:supersedes_id]
          )
          render json: VisitNoteSerializer.call(note), status: :created
        rescue ActiveRecord::RecordNotUnique
          render json: VisitNoteSerializer.call(VisitNote.find_by(client_note_id: params[:client_note_id])), status: :ok
        end

        private

        def set_assignment
          @va = current_employee.visit_assignments.assigned.includes(visit: :service_user).find(params[:id])
        end

        # Seed the checklist from the service user's active care plan on first view.
        def ensure_tasks!
          return if @va.visit_tasks.exists?

          @va.visit.service_user.care_plan_items.active.each do |cpi|
            @va.visit_tasks.create!(care_plan_item: cpi, label: cpi.label)
          end
        end

        def detail
          VisitAssignmentSerializer.call(@va, include_service_user: true).merge(
            care_plan: @va.visit.service_user.care_plan_items.active.map { |c| CarePlanItemSerializer.call(c) },
            tasks:     @va.visit_tasks.map { |t| VisitTaskSerializer.call(t) },
            notes:     @va.visit_notes.effective.order(:created_at).map { |n| VisitNoteSerializer.call(n) }
          )
        end
      end
    end
  end
end
