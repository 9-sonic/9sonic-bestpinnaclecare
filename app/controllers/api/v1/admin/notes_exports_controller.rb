module Api
  module V1
    module Admin
      # GET /api/v1/admin/notes_exports
      #   ?format=pdf|docx  &employee_id=  &service_user_id=  &from=  &to=  &q=
      #
      # Streams the filtered visit notes as a PDF or a Word .docx — the printable
      # / fileable form of the on-screen notes journal. Same filtered rows as
      # NotesController#index (both go through Notes::Query), so the export is
      # always exactly what the office was looking at, not a different query.
      #
      # No pagination here on purpose: an export is the *whole* filtered set, not
      # one page. The date/carer/client filters are what keep it bounded.
      class NotesExportsController < BaseController
        FORMATS = {
          "pdf" => {
            exporter: Notes::Exporters::PdfExporter,
            type: "application/pdf", ext: "pdf"
          },
          "docx" => {
            exporter: Notes::Exporters::DocxExporter,
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", ext: "docx"
          }
        }.freeze

        def show
          fmt = FORMATS[params[:format]] || FORMATS["pdf"]
          scope = Notes::Query.scope(**filters)
          rows  = scope.map { |n| Notes::Query.row(n) }

          data = fmt[:exporter].call(rows: rows, meta: { summary: filter_summary })
          send_data data, filename: "care-notes-#{Date.current}.#{fmt[:ext]}", type: fmt[:type]
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

        # Human-readable one-liner describing the applied filters, drawn under the
        # document title so a printed export says what it's a slice of.
        def filter_summary
          parts = []
          if params[:employee_id].present?
            parts << "Carer: #{Employee.find_by(id: params[:employee_id])&.full_name || "##{params[:employee_id]}"}"
          end
          if params[:service_user_id].present?
            parts << "Client: #{ServiceUser.find_by(id: params[:service_user_id])&.full_name || "##{params[:service_user_id]}"}"
          end
          if (from = safe_date(params[:from])) || (to = safe_date(params[:to]))
            parts << "Dates: #{from&.strftime('%-d %b %Y') || '…'} – #{to&.strftime('%-d %b %Y') || '…'}"
          end
          parts << "Search: “#{params[:q]}”" if params[:q].present?
          parts.empty? ? "All carers · all clients · all dates" : parts.join("   ·   ")
        end

        def safe_date(str)
          str.present? ? Date.parse(str.to_s) : nil
        rescue ArgumentError, TypeError
          nil
        end
      end
    end
  end
end
