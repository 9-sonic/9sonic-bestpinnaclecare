require "csv"

module Rota
  module Exporters
    # Exports the weekly rota (visits + assignments) to CSV.
    class CsvExporter
      HEADERS = %w[date day client address start end carer status].freeze

      def self.call(from:, to:)
        visits = Visit.includes(:service_user, visit_assignments: :employee)
                      .where(scheduled_start: from.beginning_of_day..to.end_of_day)
                      .order(:scheduled_start)

        CSV.generate do |csv|
          csv << HEADERS
          visits.each do |v|
            su = v.service_user
            if v.visit_assignments.any?
              v.visit_assignments.each do |va|
                csv << row(v, su, va)
              end
            else
              csv << row(v, su, nil)
            end
          end
        end
      end

      def self.row(v, su, va)
        [
          v.scheduled_start&.to_date&.iso8601,
          v.scheduled_start&.strftime("%A"),
          su&.full_name,
          [ su&.address_line1, su&.postcode ].compact.join(", "),
          v.scheduled_start&.strftime("%H:%M"),
          v.scheduled_end&.strftime("%H:%M"),
          va&.employee&.full_name || "Unfilled",
          va&.lifecycle_state || "unassigned"
        ]
      end
    end
  end
end
