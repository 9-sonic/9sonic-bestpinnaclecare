class AdminSerializer
  def self.call(admin)
    {
      id:          admin.id,
      email:       admin.email,
      first_name:  admin.first_name,
      last_name:   admin.last_name,
      full_name:   admin.full_name,
      phone:       admin.phone,
      avatar_url:  AttachmentUrl.variant(admin.avatar, Admin::AVATAR_VARIANT),
      role:        admin.role,
      active:      admin.active,
      mfa_enabled: admin.mfa_enabled,
      invited_at:         admin.invited_at,
      accepted_invite_at: admin.accepted_invite_at
    }
  end
end
