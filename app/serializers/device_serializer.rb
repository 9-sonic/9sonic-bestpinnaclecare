class DeviceSerializer
  def self.call(d)
    {
      id: d.id, fingerprint: d.fingerprint, platform: d.platform, app_version: d.app_version,
      last_seen_at: d.last_seen_at&.iso8601, revoked_at: d.revoked_at&.iso8601
    }
  end
end
