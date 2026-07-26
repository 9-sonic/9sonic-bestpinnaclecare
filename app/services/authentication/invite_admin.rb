module Authentication
  # Creates an office user in an invited state and emails a set-password link.
  class InviteAdmin
    def self.call(attrs:, invited_by: nil)
      admin = Admin.new(attrs.to_h.symbolize_keys.merge(invited_at: Time.current))
      admin.password = SecureRandom.hex(24)
      admin.save!

      token = admin.send(:set_reset_password_token)
      InvitationMailer.invite(admin, token, "admin").deliver_later
      admin
    end
  end
end
