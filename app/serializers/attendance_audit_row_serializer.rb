class AttendanceAuditRowSerializer
  def self.call(row)
    {
      staff:         row.staff,
      service_user:  row.service_user,
      shift_timing:  row.shift_timing,
      shift_began:   row.shift_began&.iso8601,
      shift_ended:   row.shift_ended&.iso8601,

      clocked_in:  row.clocked_in&.iso8601,
      offline_in:  row.offline_in,
      metres_in:   row.metres_in&.round(1),
      index_in:    row.index_in,
      late_in:     row.late_in,
      map_in:      row.map_in,
      reason:      row.reason,

      clocked_out: row.clocked_out&.iso8601,
      offline_out: row.offline_out,
      metres_out:  row.metres_out&.round(1),
      index_out:   row.index_out,
      late_out:    row.late_out,
      map_out:     row.map_out
    }
  end
end
