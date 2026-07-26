class CarePackageSlotSerializer
  def self.call(slot)
    {
      id:              slot.id,
      service_user_id: slot.service_user_id,
      name:            slot.name,
      start_time:      slot.start_time&.strftime("%H:%M"),
      end_time:        slot.end_time&.strftime("%H:%M"),
      recurrence:      slot.recurrence,
      staff_required:  slot.staff_required,
      break_minutes:   slot.break_minutes,
      effective_from:  slot.effective_from,
      effective_to:    slot.effective_to,
      active:          slot.active
    }
  end
end
