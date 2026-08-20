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

      # The visit must be in a state that can accept this clock action. Corrections
      # (manual_admin) bypass this — an admin fixes records out of band.
      if @method != "manual_admin" && (err = clockable_error)
        return Result.new(status: :blocked, geofence_result: "not_checked", error: err)
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
        # An early clock-out (before scheduled_end − early_leave_tolerance) is
        # never blocked — a carer finishing early for a real reason must still be
        # able to clock out — but it's flagged for the office to review.
        anomaly = time_anomaly? || too_early? || early_leave? || geo.result == "no_fix" || geo.result == "fail"
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
          ip_address:           Current.ip_address,
          client_event_id:      @client_event_id,
          reason:               @reason,
          corrects_id:          @corrects_id,
          origin:               origin,
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

    # How this event reached us — recorded so the CQC visit-attendance audit can
    # report offline-taken taps. An admin correction is manual_admin; the offline
    # sync ingest calls us with on_block: :flag (the live endpoint uses :reject).
    def origin
      return "manual_admin" if @method == "manual_admin"
      return "offline_sync" if @on_block == :flag

      "live"
    end

    # Returns an error code if this clock action can't apply to the visit's
    # current state, else nil. Guards against clocking a cancelled/missed/already-
    # completed visit, clocking in twice, or clocking out with no clock-in.
    def clockable_error
      state = @va.lifecycle_state
      # A visit provisionally marked "missed" can still be reconciled by a clock-in
      # that was taken offline and only synced now — the carer was there, the tap
      # just arrived late. Only the offline-sync path (on_block: :flag) may do this;
      # a live tap after the office has been alerted stays rejected.
      reconcilable = state == "missed" && @on_block == :flag && @kind == "clock_in"
      return "visit_not_clockable" if !reconcilable && %w[cancelled missed completed].include?(state)

      if @kind == "clock_in"
        "already_clocked_in" if @va.effective_clock_in
      elsif @kind == "clock_out"
        return "not_clocked_in" unless @va.effective_clock_in
        return "already_clocked_out" if @va.effective_clock_out
        if @method != "manual_admin" && (@occurred_at - @va.effective_clock_in.occurred_at) < 2.minutes
          "minimum_duration_not_met"
        end
      end
    end

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

    # A clock-out more than early_leave_tolerance_minutes before the scheduled
    # end — flagged for review (not blocked). Only applies to clock-out.
    def early_leave?
      return false unless @kind == "clock_out"

      finish = @va.visit.scheduled_end
      tolerance = Setting.instance.early_leave_tolerance_minutes.to_i
      finish.present? && @occurred_at < (finish - tolerance.minutes)
    end

    def advance_lifecycle(anomaly:)
      case @kind
      when "clock_in"
        was_missed = @va.lifecycle_state == "missed"
        start = @va.visit.scheduled_start
        grace_end = start + Setting.instance.late_grace_minutes.minutes
        state = if anomaly
          :pending_review
        elsif @occurred_at > grace_end
          # Turned up properly late — past the grace window. Flag it so the office
          # reviews and the carer gives a reason (an admin can amend the record).
          :pending_review
        elsif @occurred_at > start
          :late            # after the scheduled start but within grace
        else
          :in_progress
        end
        @va.update!(actual_start: @occurred_at, lifecycle_state: state)
        # This tap reconciled a provisionally-missed visit: the carer WAS there,
        # the tap just synced late. Clear the "missed" alert the timer raised so
        # the office isn't chasing a visit that actually happened. The clock event
        # stays on the record (append-only) as the honest proof it was attended.
        resolve_missed_alert if was_missed
      when "clock_out"
        @va.update!(actual_end: @occurred_at, worked_minutes: worked_minutes,
                    lifecycle_state: anomaly ? :pending_review : :completed)
      end
      # break_start / break_end record the event but don't change the lifecycle.
    end

    # Resolve the open "missed_visit" alert for this visit — a synced clock-in
    # proved the carer attended, so the alert's premise no longer holds.
    def resolve_missed_alert
      Alert.open_for(@va).where(alert_type: "missed_visit")
           .update_all(state: "resolved", resolved_at: Time.current,
                       resolution_note: "Auto-resolved: carer's clock-in synced in after the visit was flagged missed.")
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
