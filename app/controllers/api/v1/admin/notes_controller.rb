module Api
  module V1
    module Admin
      # GET /api/v1/admin/notes
      #   ?employee_id=  &service_user_id=  &from=<date>  &to=<date>  &q=  &page=  &per_page=
      #
      # The office-wide visit-note journal: every carer's write-up across every
      # visit, newest first, filterable by carer AND client together (the per-carer
      # and per-client pages only ever show one side). Paginated so a year of
      # notes never lands in one response. Same filtered scope the PDF/DOCX export
      # streams — see Notes::Query.
      class NotesController < BaseController
        def index
          scope = Notes::Query.scope(**filters)
          paginate(scope, per_page: 50) { |n| Notes::Query.row(n) }
        end

        private

        def filters
          {
            employee_id: params[:employee_id].presence,
            service_user_id: params[:service_user_id].presence,
            from: safe_date(params[:from]),
            to: safe_date(params[:to]),
            q: params[:q].presence
          }
        end

        # Bad dates filter nothing rather than 500ing (mirrors the sibling
        # notes actions on service_users / carer_profile).
        def safe_date(str)
          str.present? ? Date.parse(str.to_s) : nil
        rescue ArgumentError, TypeError
          nil
        end
      end
    end
  end
end
