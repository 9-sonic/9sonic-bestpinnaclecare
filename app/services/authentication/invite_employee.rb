module Authentication
  # Creates a carer in an invited state and emails a link to set their password.
  # They "accept" by setting a password via the standard reset flow.
  class InviteEmployee
    def self.call(attrs:, invited_by: nil)
      employee = Employee.new(attrs.to_h.symbolize_keys.merge(invited_at: Time.current))
      employee.password = SecureRandom.hex(24) # placeholder until they accept
      employee.save!

      token = employee.send(:set_reset_password_token)
      InvitationMailer.invite(employee, token, "staff").deliver_later
      employee
    end
  end
end
