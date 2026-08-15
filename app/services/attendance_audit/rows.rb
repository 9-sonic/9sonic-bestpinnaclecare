module AttendanceAudit
  # Shared column layout for the CQC visit-attendance export, so the CSV and
  # XLSX exporters emit byte-identical headers and cells. Column order matches
  # the client's existing audit file exactly.
  module Rows
    HEADERS = [
      "Staff", "Service User", "Shift Timing", "Shift Began", "Shift Ended",
      "Clocked In", "Offline clock in", "Clock In Metres Away", "Index",
      "Clock in Late", "Clock in Map", "Reason",
      "Clocked Out", "Offline clock out", "Clock Out Metres Away", "Index2",
      "Clock out Late", "Clock out Map"
    ].freeze

    module_function

    # Turn an AttendanceAudit::Row into the flat cell array, in HEADERS order.
    def cells(r)
      [
        r.staff, r.service_user, r.shift_timing,
        clock_time(r.shift_began), clock_time(r.shift_ended),
        stamp(r.clocked_in), r.offline_in, metres(r.metres_in), r.index_in,
        late(r.late_in), r.map_in, r.reason,
        stamp(r.clocked_out), r.offline_out, metres(r.metres_out), r.index_out,
        late(r.late_out), r.map_out
      ]
    end

    # Full clock stamp, e.g. "Sunday, February 1, 2026 at 7:00:00 AM".
    # Clean UTF-8 with an ordinary space — not the narrow-no-break-space that
    # arrived mojibaked ("â¯") in the client's source file.
    def stamp(time)
      return nil if time.nil?

      time.strftime("%A, %B %-d, %Y at %-I:%M:%S %p")
    end

    # Scheduled began/ended are shown as a time of day only, matching the client
    # file's "Shift Began"/"Shift Ended" columns.
    def clock_time(time)
      return nil if time.nil?

      time.strftime("%-I:%M:%S %p")
    end

    def metres(m) = m.nil? ? nil : m.round(1)

    # "N minutes" / "1 minute" / "0 minutes", or blank when there was no tap.
    def late(minutes)
      return nil if minutes.nil?

      "#{minutes} #{minutes == 1 ? 'minute' : 'minutes'}"
    end
  end
end
