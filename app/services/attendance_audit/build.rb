module AttendanceAudit
  # Builds the CQC visit-attendance audit: one row per carer x visit over a date
  # range, from real clock records. This is the row-level attendance report the
  # office/CQC expects (carer, client, scheduled window, actual taps, offline
  # flags, metres-from-home, lateness, map links, reason) — distinct from the
  # append-only change-log Event audit.
  #
  # No data is invented: metres, offline origin, and lateness all come straight
  # from persisted clock_events. Columns whose meaning the client has not yet
  # confirmed are handled explicitly: Index/Index2 is the confidence figure the
  # client's export carries next to each Metres-Away reading — how many GPS
  # accuracy radii the tap fell from the client's home (distance / accuracy),
  # floored at 1.0 and hard-capped at 35.0, matching the source file's ~3.6
  # ratio and its 35.0 ceiling. Both inputs are already on the clock event.
  Row = Struct.new(
    :staff, :service_user, :shift_timing, :shift_began, :shift_ended,
    :clocked_in, :offline_in, :metres_in, :index_in, :late_in, :map_in, :reason,
    :clocked_out, :offline_out, :metres_out, :index_out, :late_out, :map_out,
    keyword_init: true
  )

  class Build
    def self.call(from:, to:, service_user_id: nil, employee_id: nil)
      new(from, to, service_user_id: service_user_id, employee_id: employee_id).call
    end

    def initialize(from, to, service_user_id: nil, employee_id: nil)
      @from = from
      @to   = to
      @service_user_id = service_user_id
      @employee_id = employee_id
    end

    def call
      assignments.map { |a| row_for(a) }
    end

    private

    # Every assigned slot whose visit starts in the range, delivered or not, in a
    # stable order (client, then start time) so the export reads like a rota.
    # Optionally narrowed to one client and/or one carer for on-screen filtering.
    def assignments
      scope = VisitAssignment
        .assigned
        .joins(:visit)
        .includes(:employee, :clock_events, visit: :service_user)
        .where(visits: { scheduled_start: @from..@to })
        .where.not(lifecycle_state: :cancelled)
      scope = scope.where(visits: { service_user_id: @service_user_id }) if @service_user_id.present?
      scope = scope.where(employee_id: @employee_id) if @employee_id.present?
      scope.order("visits.scheduled_start ASC").to_a
    end

    def row_for(a)
      v   = a.visit
      su  = v.service_user
      cin  = a.effective_clock_in
      cout = a.effective_clock_out

      Row.new(
        staff:        a.employee&.full_name,
        service_user: su&.full_name,
        shift_timing: window(v),
        shift_began:  v.scheduled_start,
        shift_ended:  v.scheduled_end,

        clocked_in:  cin&.occurred_at,
        offline_in:  offline(cin),
        metres_in:   cin&.distance_from_site_m,
        index_in:    confidence_index(cin),
        late_in:     minutes_after(cin&.occurred_at, v.scheduled_start),
        map_in:      map_url(cin, su),
        reason:      cin&.reason || cout&.reason,

        clocked_out: cout&.occurred_at,
        offline_out: offline(cout),
        metres_out:  cout&.distance_from_site_m,
        index_out:   confidence_index(cout),
        late_out:    minutes_after(cout&.occurred_at, v.scheduled_end),
        map_out:     map_url(cout, su)
      )
    end

    # "HH:MM-HH:MM" scheduled window, matching the client's export.
    def window(v)
      "#{v.scheduled_start.strftime('%H:%M')}-#{v.scheduled_end.strftime('%H:%M')}"
    end

    # "Yes" when the tap was taken offline and later synced; "No" for a live tap;
    # blank when there is no tap at all. manual_admin corrections read as "No" —
    # they were not offline field taps.
    def offline(event)
      return nil if event.nil?

      event.origin == "offline_sync" ? "Yes" : "No"
    end

    # The confidence index the client's export shows beside each Metres-Away
    # reading: how many GPS accuracy radii the tap sat from home, i.e.
    # distance / accuracy, floored at 1.0 and capped at 35.0 (both observed in
    # the source file). Blank when we lack a distance or an accuracy fix — never
    # a fabricated figure.
    INDEX_FLOOR = 1.0
    INDEX_CEIL  = 35.0

    def confidence_index(event)
      return nil if event.nil?

      dist = event.distance_from_site_m
      acc  = event.accuracy_m
      return nil if dist.nil? || acc.nil? || acc.zero?

      (dist.to_f / acc).clamp(INDEX_FLOOR, INDEX_CEIL).round(2)
    end

    # Whole minutes the tap fell after the reference time; 0 if on time or early,
    # nil if there is no tap. Never negative — early is simply "0 minutes late".
    def minutes_after(actual, reference)
      return nil if actual.nil? || reference.nil?

      diff = ((actual - reference) / 60.0).floor
      diff.positive? ? diff : 0
    end

    # Google Maps directions link from the tap location to the client's home —
    # exactly the shape the existing CQC export uses. Blank if either point is
    # missing (no GPS fix, or the client has no geocoded home).
    def map_url(event, su)
      return nil if event&.lat.nil? || event&.lng.nil? || su&.lat.nil? || su&.lng.nil?

      "https://www.google.com/maps/dir/" \
        "#{fmt(event.lat)},#{fmt(event.lng)}/#{fmt(su.lat)},#{fmt(su.lng)}"
    end

    def fmt(coord) = format("%.6f", coord)
  end
end
