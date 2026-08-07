require "swagger_helper"

# Shared (Admin + Employee) messaging & notification routes the PWA calls but
# the spec did not describe. Documented from the carer's side.
RSpec.describe "Notifications & chat", type: :request do
  let(:employee) { create(:employee) }
  let(:Authorization) { "Bearer #{jwt_for(employee, :employee)}" }

  path "/api/v1/notifications" do
    get("List notifications (newest first)") do
      tags "Notifications"; produces "application/json"; security [ bearerAuth: [] ]
      description "unseen=true limits to unread; before=<iso8601> paginates backwards; limit (1..200, default 50)."
      parameter name: :unseen, in: :query, required: false, schema: { type: :boolean }
      parameter name: :before, in: :query, required: false, schema: { type: :string, format: "date-time" }
      parameter name: :limit,  in: :query, required: false, schema: { type: :integer }
      let!(:notification) { employee.notifications.create!(notification_type: "visit_reminder", channel: "in_app", title: "Upcoming visit at 14:00") }
      let(:unseen) { nil }; let(:before) { nil }; let(:limit) { nil }
      response(200, "notifications") do
        schema type: :array, items: { type: :object, properties: {
          id: { type: :integer }, notification_type: { type: :string }, title: { type: :string },
          body: { type: :string, nullable: true }, channel: { type: :string }, status: { type: :string },
          seen_at: { type: :string, nullable: true }, created_at: { type: :string }
        } }
        run_test!
      end
    end
  end

  path "/api/v1/notifications/{id}/seen" do
    parameter name: :id, in: :path, type: :integer
    post("Mark one notification read") do
      tags "Notifications"; produces "application/json"; security [ bearerAuth: [] ]
      let(:id) { employee.notifications.create!(notification_type: "visit_reminder", channel: "in_app", title: "Upcoming visit").id }
      response(200, "seen") do
        schema type: :object, properties: { id: { type: :integer }, seen_at: { type: :string, nullable: true } }
        run_test!
      end
    end
  end

  path "/api/v1/notification_preferences" do
    get("Read notification preferences") do
      tags "Notifications"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "preferences") do
        schema type: :array, items: { type: :object, properties: {
          notification_type: { type: :string }, in_app: { type: :boolean }, push: { type: :boolean }, email: { type: :boolean }
        } }
        run_test!
      end
    end

    patch("Update one channel preference (upserts)") do
      tags "Notifications"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, schema: {
        type: :object, properties: {
          notification_type: { type: :string }, in_app: { type: :boolean }, push: { type: :boolean }, email: { type: :boolean }
        }, required: %w[notification_type]
      }
      response(200, "saved") do
        schema type: :object, properties: {
          notification_type: { type: :string }, in_app: { type: :boolean }, push: { type: :boolean }, email: { type: :boolean }
        }
        let(:body) { { notification_type: "visit_reminder", push: false } }
        run_test!
      end
    end
  end

  path "/api/v1/conversations/{conversation_id}/messages" do
    parameter name: :conversation_id, in: :path, type: :integer
    let(:conversation) { Messaging::CreateConversation.direct(creator: employee, other: create(:admin)) }
    let(:conversation_id) { conversation.id }

    get("Messages in a conversation (newest first, 50)") do
      tags "Chat"; produces "application/json"; security [ bearerAuth: [] ]
      description "before=<iso8601> paginates backwards. A non-participant gets 404. Each message carries read_count / recipient_count from delivery receipts."
      parameter name: :before, in: :query, required: false, schema: { type: :string, format: "date-time" }
      let(:before) { nil }
      response(200, "messages") do
        schema type: :array, items: { type: :object, properties: {
          id: { type: :integer }, conversation_id: { type: :integer }, sender_type: { type: :string }, sender_id: { type: :integer },
          body: { type: :string, nullable: true }, broadcast: { type: :boolean }, client_message_id: { type: :string },
          read_count: { type: :integer }, recipient_count: { type: :integer }, created_at: { type: :string }
        } }
        run_test!
      end
    end

    post("Send a message (idempotent on client_message_id)") do
      tags "Chat"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      description "A replay with the same client_message_id returns the original message, never a duplicate."
      parameter name: :body, in: :body, schema: {
        type: :object, properties: { body: { type: :string }, client_message_id: { type: :string, format: :uuid }, broadcast: { type: :boolean } },
        required: %w[body client_message_id]
      }
      response(201, "sent") do
        schema type: :object, properties: {
          id: { type: :integer }, conversation_id: { type: :integer }, body: { type: :string }, client_message_id: { type: :string }, created_at: { type: :string }
        }
        let(:body) { { body: "On my way, ETA 10 minutes.", client_message_id: SecureRandom.uuid } }
        run_test!
      end
    end
  end

  path "/api/v1/messages/{id}/receipts" do
    parameter name: :id, in: :path, type: :integer
    post("Mark a message read") do
      tags "Chat"; produces "application/json"; security [ bearerAuth: [] ]
      let(:other) { create(:admin) }
      let(:conversation) { Messaging::CreateConversation.direct(creator: employee, other: other) }
      let(:id) { Messaging::SendMessage.call(conversation: conversation, sender: other, body: "hello", client_message_id: SecureRandom.uuid).id }
      response(200, "read") do
        schema type: :object, properties: { message_id: { type: :integer }, read_at: { type: :string, nullable: true } }
        run_test!
      end
    end
  end

  path "/api/v1/conversations/{id}/mute" do
    parameter name: :id, in: :path, type: :integer
    patch("Mute / unmute a conversation") do
      tags "Chat"; consumes "application/json"; produces "application/json"; security [ bearerAuth: [] ]
      parameter name: :body, in: :body, required: false, schema: { type: :object, properties: { muted: { type: :boolean } } }
      let(:id) { Messaging::CreateConversation.direct(creator: employee, other: create(:admin)).id }
      let(:body) { { muted: true } }
      response(200, "updated") { schema type: :object, properties: { id: { type: :integer }, muted: { type: :boolean } }; run_test! }
    end
  end

  path "/api/v1/conversations/{id}/chase" do
    parameter name: :id, in: :path, type: :integer
    post("Chase the participants who haven't read the latest message") do
      tags "Chat"; produces "application/json"; security [ bearerAuth: [] ]
      let(:convo) { Messaging::CreateConversation.channel(creator: employee, title: "#team", participants: [ create(:employee) ]) }
      let(:id) { convo.id }
      before { Messaging::SendMessage.call(conversation: convo, sender: employee, body: "read me", client_message_id: SecureRandom.uuid) }
      response(200, "chased count") { schema type: :object, properties: { chased: { type: :integer } }; run_test! }
    end
  end

  path "/api/v1/conversations/{conversation_id}/messages/{id}/pin" do
    parameter name: :conversation_id, in: :path, type: :integer
    parameter name: :id, in: :path, type: :integer
    let(:conversation) { Messaging::CreateConversation.direct(creator: employee, other: create(:admin)) }
    let(:conversation_id) { conversation.id }
    let(:id) { Messaging::SendMessage.call(conversation: conversation, sender: employee, body: "pin me", client_message_id: SecureRandom.uuid).id }

    post("Pin a message to the top of a conversation") do
      tags "Chat"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "pinned") { schema type: :object, properties: { id: { type: :integer }, pinned_at: { type: :string, nullable: true } }; run_test! }
    end
    delete("Unpin a message") do
      tags "Chat"; produces "application/json"; security [ bearerAuth: [] ]
      response(200, "unpinned") { schema type: :object, properties: { id: { type: :integer }, pinned_at: { type: :string, nullable: true } }; run_test! }
    end
  end
end
