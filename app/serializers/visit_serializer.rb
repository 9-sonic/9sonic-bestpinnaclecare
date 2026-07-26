class VisitSerializer
  def self.call(visit, include_service_user: false)
    payload = {
      id:              visit.id,
      service_user_id: visit.service_user_id,
      scheduled_start: visit.scheduled_start&.iso8601,
      scheduled_end:   visit.scheduled_end&.iso8601,
      status:          visit.status,
      staff_required:  visit.staff_required,
      published_at:    visit.published_at&.iso8601
    }
    payload[:service_user] = ServiceUserSerializer.call(visit.service_user) if include_service_user
    payload
  end
end
