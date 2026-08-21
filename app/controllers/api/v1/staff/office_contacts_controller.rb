module Api
  module V1
    module Staff
      # The office directory a carer can start a chat with. Admins only — a carer
      # may message the office, never enumerate or DM other carers or clients.
      # Only active accounts are listed (a deactivated admin can't be messaged).
      class OfficeContactsController < BaseController
        ROLE_LABELS = {
          "registered_manager" => "Registered manager",
          "manager" => "Manager",
          "coordinator" => "Coordinator",
          "auditor" => "Auditor"
        }.freeze

        # GET /api/v1/staff/office_contacts
        def index
          admins = ::Admin.active.order(:first_name, :last_name)
          render json: admins.map { |a|
            {
              type: "Admin",
              id: a.id,
              full_name: a.full_name,
              role: a.role,
              role_label: ROLE_LABELS[a.role] || a.role&.humanize,
              avatar_url: AttachmentUrl.for(a.avatar)
            }
          }
        end
      end
    end
  end
end
