module Lifecycle
  # Timer-driven state machine for one visit assignment (§6). Advances time-based
  # transitions and raises alerts; clock-driven transitions live in RecordClockEvent.
  class EvaluateAssignment
    def self.call(va, now: Time.current, settings: Setting.instance)
      return va.lifecycle_state unless va.assignment_status == "assigned"

      start  = va.visit.scheduled_start
      finish = va.visit.scheduled_end

      case va.lifecycle_state
      when "scheduled"
        va.update!(lifecycle_state: :check_in_window) if now >= start - settings.checkin_window_before_start_minutes.minutes
      when "check_in_window"
        va.update!(lifecycle_state: :grace_period) if now >= start
      when "grace_period"
        # Grace ends late_grace_minutes after the scheduled start. Once it passes
        # with still no clock-in, escalate to the office straight away so they can
        # contact the carer or reassign — waiting longer just eats the visit,
        # especially a short one. (This provisional "missed" is reconciled if an
        # offline clock-in later syncs in — see Clocking::RecordClockEvent.)
        if now >= start + settings.late_grace_minutes.minutes
          va.update!(lifecycle_state: :missed)
          Alerts::Raise.call(subject: va, alert_type: "missed_visit", severity: "high")
        end
      when "in_progress"
        if now >= finish + settings.auto_close_after_minutes.minutes
          auto_close(va, finish)
        elsif now >= finish + settings.overdue_threshold_minutes.minutes
          va.update!(lifecycle_state: :overdue)
          Alerts::Raise.call(subject: va, alert_type: "no_clock_out", severity: "high")
        end
      when "overdue"
        auto_close(va, finish) if now >= finish + settings.auto_close_after_minutes.minutes
      end

      va.lifecycle_state
    end

    def self.auto_close(va, finish)
      va.update!(actual_end: finish, lifecycle_state: :pending_review, flags: (va.flags | %w[auto_closed]))
    end
  end
end
