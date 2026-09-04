module Assignments
  # Minutes a carer actually worked across a set of their own assignments,
  # counting overlapping visits ONCE.
  #
  # Couples are the reason. Two clients at one address are two visits, and a
  # carer serving both is clocked into both for the same half hour. Summing
  # worked_minutes counts that half hour twice, so "hours worked" for the PERSON
  # comes out double. Care DELIVERED is still two visits — that figure is summed
  # per visit elsewhere and is deliberately not this.
  #
  # Where nothing overlaps this returns exactly the old sum, so it changes
  # nothing for a carer who works one visit at a time.
  class WorkedTime
    # Assignments with no clock times can't be merged (imported or part-recorded
    # data), so their stored worked_minutes is added as it stands.
    def self.minutes(assignments)
      timed, untimed = Array(assignments).partition { |a| a.actual_start && a.actual_end }

      seconds = union_seconds(timed.map { |a| [ a.actual_start, a.actual_end ] })
      # Breaks are already excluded from worked_minutes, so exclude them here
      # too. Two overlapping visits that BOTH record a break would subtract it
      # twice; a break inside a shared call is not a shape this data produces.
      seconds -= timed.sum { |a| a.break_seconds.to_i }

      [ (seconds / 60.0).round, 0 ].max + untimed.sum { |a| a.worked_minutes.to_i }
    end

    # Total length of the union of [from, to] ranges — overlapping ones merged.
    def self.union_seconds(ranges)
      merged = []
      ranges.reject { |from, to| from.nil? || to.nil? || to <= from }
            .sort_by(&:first)
            .each do |from, to|
        last = merged.last
        if last && from <= last[1]
          last[1] = to if to > last[1]
        else
          merged << [ from, to ]
        end
      end
      merged.sum { |from, to| to - from }
    end
  end
end
