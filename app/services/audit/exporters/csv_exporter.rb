require "csv"

module Audit
  module Exporters
    # Exports the Event audit log to CSV. Accepts the same scope/filter
    # params used by AuditController#index.
    class CsvExporter
      HEADERS = %w[occurred_at event_type actor_type actor_name aggregate_type aggregate_id payload].freeze

      def self.call(scope)
        CSV.generate do |csv|
          csv << HEADERS
          scope.find_each do |e|
            csv << [
              e.occurred_at&.iso8601,
              e.event_type,
              e.actor_type,
              actor_name(e),
              e.aggregate_type,
              e.aggregate_id,
              e.payload&.to_json
            ]
          end
        end
      end

      def self.actor_name(e)
        return "System" if e.actor_id.nil? || e.actor_type == "System"
        return e.actor&.full_name if EventSerializer::ACTOR_MODELS.include?(e.actor_type)

        nil
      end
    end
  end
end
