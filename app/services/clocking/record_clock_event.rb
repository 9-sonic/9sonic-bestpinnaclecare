module Clocking
  # The single writer for clock events. Idempotent on client_event_id; runs the
  # server-authoritative geofence + clock-skew checks; writes the append-only
  # event; advances the visit lifecycle. Used both by the live clock endpoint
  # (on_block: :reject) and by offline sync ingest (on_block: :flag).
  class RecordClockEvent
    Result = Struct.new(:status, :clock_event, :geofence_result, :distance_m, :lifecycle_state, :error, keyword_init: true)

    def self.call(**kwargs) = new(**kwargs).call

    def initialize(visit_assignment:, kind:, client_event_id:, occurred_at:, actor:,
                   lat: nil, lng: nil, accuracy_m: nil, device_fingerprint: nil,
                   method: "gps", reason: nil, corrects_id: nil, on_block: :reject)
      @va = visit_assignment
      @kind = kind.to_s
      @client_event_id = client_event_id
      @occurred_at = occurred_at.is_a?(String) ? Time.zone.parse(occurred_at) : occurred_at
      @actor = actor
      @lat = lat
      @lng = lng
      @accuracy_m = accuracy_m
      @device_fingerprint = device_fingerprint
      @method = method
      @reason = reason
      @corrects_id = corrects_id
      @on_block = on_block
    end

    def call
      if (existing = ClockEvent.find_by(client_event_id: @client_event_id))
        return replay(existing)
      end

      if @method == "manual_admin"
        # Admin-authorised correction: no geofence/skew enforcement.
        geo = EvaluateGeofence::Result.new(result: "not_checked", distance_m: nil, blocked: false)
        anomaly = false
      else
        geo = EvaluateGeofence.call(service_user: @va.visit.service_user, lat: @lat, lng: @lng)
        if @kind == "clock_in" && geo.blocked && @on_block == :reject
          return Result.new(status: :blocked, geofence_result: geo.result, distance_m: geo.distance_m, error: "too_far")
        end
        # Block mode requires a real location on a *live* clock-in. Otherwise the
        # geofence is bypassed by clocking in with location off/denied: no fix ->
        # no distance -> not "too_far" -> allowed. A device that reached us live
        # has connectivity, so it can provide GPS. Offline sync (on_block: :flag)
        # still records no_fix and flags it, so genuine dead-zone clock-ins are
        # never dropped.
        if @kind == "clock_in" && @on_block == :reject && geo.result == "no_fix" && block_mode?
          return Result.new(status: :blocked, geofence_result: geo.result, error: "location_required")
        end
        # A shift can't be started before its check-in window opens — i.e. more
        # than Setting.checkin_window_before_start_minutes before scheduled_start.
        # Live clock-ins are rejected; offline events that turn up early are
        # flagged for review rather than silently accepted.
        if @kind == "clock_in" && too_early? && @on_block == :reject
          return Result.new(status: :blocked, geofence_result: geo.result, distance_m: geo.distance_m, error: "too_early")
        end
        anomaly = time_anomaly? || too_early? || geo.result == "no_fix" || geo.result == "fail"
      end

      event = nil
      ActiveRecord::Base.transaction do
        event = ClockEvent.create!(
          visit_assignment:     @va,
          kind:                 @kind,
          occurred_at:          @occurred_at,
          method:               @method,
          lat:                  @lat,
          lng:                  @lng,
          accuracy_m:           @accuracy_m,
          geofence_result:      geo.result,
          distance_from_site_m: geo.distance_m,
          device_fingerprint:   @device_fingerprint,
          client_event_id:      @client_event_id,
          reason:               @reason,
          corrects_id:          @corrects_id,
          created_by:           @actor
        )
        advance_lifecycle(anomaly:)
      end

      raise_geo_alert(geo.result) unless @method == "manual_admin"
      Result.new(status: :ok, clock_event: event, geofence_result: geo.result,
                 distance_m: geo.distance_m, lifecycle_state: @va.reload.lifecycle_state)
    rescue ActiveRecord::RecordNotUnique
      replay(ClockEvent.find_by(client_event_id: @client_event_id))
    end

    private

    def replay(event)
      Result.new(status: :replay, clock_event: event, geofence_result: event&.geofence_result,
                 distance_m: event&.distance_from_site_m, lifecycle_state: @va.reload.lifecycle_state)
    end

    def time_anomaly?
      ((Time.current - @occurred_at).abs / 60.0) > Setting.instance.clock_skew_tolerance_minutes
    end

    def block_mode?
      Setting.instance.geofence_for(@va.visit.service_user)[:mode] == "block"
    end

    # True when the clock-in is earlier than the visit's check-in window allows.
    def too_early?
      return @too_early if defined?(@too_early)

      start = @va.visit.scheduled_start
      window = Setting.instance.checkin_window_before_start_minutes.to_i
      @too_early = start.present? && @occurred_at < (start - window.minutes)
    end

    def advance_lifecycle(anomaly:)
      case @kind
      when "clock_in"
        state = if anomaly
          :pending_review
        elsif @occurred_at > @va.visit.scheduled_start
          :late            # clocked in after the visit's scheduled start
        else
          :in_progress
        end
        @va.update!(actual_start: @occurred_at, lifecycle_state: state)
      when "clock_out"
        @va.update!(actual_end: @occurred_at, worked_minutes: worked_minutes,
                    lifecycle_state: anomaly ? :pending_review : :completed)
      end
      # break_start / break_end record the event but don't change the lifecycle.
    end

    def worked_minutes
      ci = @va.effective_clock_in
      co = @va.effective_clock_out
      return nil unless ci && co

      # Deduct recorded breaks (a carer isn't paid for break time) in seconds,
      # rounding once at the end so payroll doesn't drift from double-rounding.
      net_seconds = (co.occurred_at - ci.occurred_at) - @va.break_seconds
      [ (net_seconds / 60.0).round, 0 ].max
    end

    def raise_geo_alert(result)
      return unless %w[clock_in clock_out].include?(@kind)
      return unless %w[no_fix fail].include?(result)

      Alerts::Raise.call(subject: @va, alert_type: "geo_anomaly")
    end
  end
end
