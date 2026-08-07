module ServiceUsers
  # Per-client aggregates from real records: visits per week (from the care
  # package), the carers who regularly attend (from assignments), and clock-in
  # adherence (share of clock-ins that passed the geofence). Keyed by id.
  class Stats
    def self.call
      new.call
    end

    def call
      vpw = visits_per_week
      carers = carers_by_client
      adh = adherence
      ServiceUser.pluck(:id).index_with do |id|
        on, total = adh[id] || [ 0, 0 ]
        {
          visits_per_week: vpw[id] || 0,
          carers:          carers[id] || [],
          adherence:       total.zero? ? nil : ((on.to_f / total) * 100).round
        }
      end
    end

    private

    def visits_per_week
      result = Hash.new(0)
      CarePackageSlot.where(active: true).pluck(:service_user_id, :recurrence).each do |suid, rec|
        result[suid] += rec == "daily" ? 7 : rec.to_s.split(",").size.clamp(1, 7)
      end
      result
    end

    def carers_by_client
      rows = VisitAssignment.assigned.joins(:visit, :employee)
                            .where(visits: { scheduled_start: 30.days.ago.. })
                            .pluck("visits.service_user_id", "employees.first_name", "employees.last_name")
      map = Hash.new { |h, k| h[k] = [] }
      rows.each do |suid, first, last|
        name = "#{first} #{last}"
        map[suid] << name unless map[suid].include?(name)
      end
      map
    end

    def adherence
      rows = ClockEvent.where(kind: :clock_in).joins(visit_assignment: :visit)
                       .where(visits: { scheduled_start: 30.days.ago.. })
                       .pluck("visits.service_user_id", :geofence_result)
      acc = Hash.new { |h, k| h[k] = [ 0, 0 ] }
      rows.each do |suid, geo|
        acc[suid][1] += 1
        acc[suid][0] += 1 if geo.to_s == "pass"
      end
      acc
    end
  end
end
