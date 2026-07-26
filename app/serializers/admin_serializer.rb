class AdminSerializer
  def self.call(admin)
    {
      id:          admin.id,
      email:       admin.email,
      first_name:  admin.first_name,
      last_name:   admin.last_name,
      full_name:   admin.full_name,
      role:        admin.role,
      active:      admin.active,
      mfa_enabled: admin.mfa_enabled
    }
  end
end
