# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_08_17_120000) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "citext"
  enable_extension "pg_catalog.plpgsql"
  enable_extension "pgcrypto"

  # Custom types defined in this database.
  # Note that some types may not work with other database engines. Be careful if changing database.
  create_enum "admin_role", ["registered_manager", "manager", "coordinator", "finance", "auditor"]
  create_enum "alert_state", ["open", "acknowledged", "resolved"]
  create_enum "availability_slot", ["morning", "afternoon", "evening", "night"]
  create_enum "clock_kind", ["clock_in", "clock_out", "break_start", "break_end"]
  create_enum "clock_origin", ["live", "offline_sync", "manual_admin"]
  create_enum "conversation_kind", ["direct", "group", "channel"]
  create_enum "employee_role", ["carer"]
  create_enum "geofence_result", ["pass", "fail", "no_fix", "not_checked"]
  create_enum "lifecycle_state", ["scheduled", "check_in_window", "grace_period", "late", "in_progress", "overdue", "pending_review", "completed", "missed", "cancelled"]
  create_enum "shift_status", ["draft", "published", "cancelled"]

  create_table "active_storage_attachments", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.datetime "created_at", null: false
    t.string "name", null: false
    t.bigint "record_id", null: false
    t.string "record_type", null: false
    t.index ["blob_id"], name: "index_active_storage_attachments_on_blob_id"
    t.index ["record_type", "record_id", "name", "blob_id"], name: "index_active_storage_attachments_uniqueness", unique: true
  end

  create_table "active_storage_blobs", force: :cascade do |t|
    t.bigint "byte_size", null: false
    t.string "checksum"
    t.string "content_type"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.string "key", null: false
    t.text "metadata"
    t.string "service_name", null: false
    t.index ["key"], name: "index_active_storage_blobs_on_key", unique: true
  end

  create_table "active_storage_variant_records", force: :cascade do |t|
    t.bigint "blob_id", null: false
    t.string "variation_digest", null: false
    t.index ["blob_id", "variation_digest"], name: "index_active_storage_variant_records_uniqueness", unique: true
  end

  create_table "admins", force: :cascade do |t|
    t.timestamptz "accepted_invite_at"
    t.boolean "active", default: true, null: false
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.citext "email", null: false
    t.text "encrypted_password", default: "", null: false
    t.integer "failed_attempts", default: 0, null: false
    t.text "first_name", null: false
    t.timestamptz "invited_at"
    t.text "last_name", null: false
    t.timestamptz "last_sign_in_at"
    t.timestamptz "locked_at"
    t.text "mfa_backup_codes", default: [], null: false, array: true
    t.timestamptz "mfa_confirmed_at"
    t.boolean "mfa_enabled", default: true, null: false
    t.text "mfa_secret"
    t.text "phone"
    t.timestamptz "reset_password_sent_at"
    t.string "reset_password_token"
    t.enum "role", null: false, enum_type: "admin_role"
    t.string "unlock_token"
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.string "webauthn_id"
    t.index ["active"], name: "idx_admins_active", where: "active"
    t.index ["email"], name: "index_admins_on_email", unique: true
    t.index ["reset_password_token"], name: "index_admins_on_reset_password_token", unique: true
    t.index ["unlock_token"], name: "index_admins_on_unlock_token", unique: true
  end

  create_table "alerts", force: :cascade do |t|
    t.timestamptz "acknowledged_at"
    t.bigint "acknowledged_by_admin_id"
    t.text "alert_type", null: false
    t.timestamptz "raised_at", default: -> { "now()" }, null: false
    t.text "resolution_note"
    t.timestamptz "resolved_at"
    t.text "severity", default: "normal", null: false
    t.enum "state", default: "open", null: false, enum_type: "alert_state"
    t.bigint "subject_id", null: false
    t.text "subject_type", null: false
    t.index ["state", "raised_at"], name: "idx_alerts_open", order: { raised_at: :desc }
    t.index ["subject_type", "subject_id", "alert_type"], name: "idx_alerts_dedupe", unique: true, where: "(state = 'open'::alert_state)"
  end

  create_table "care_package_slots", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.integer "break_minutes", default: 0, null: false
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.date "effective_from", null: false
    t.date "effective_to"
    t.time "end_time", null: false
    t.text "name", null: false
    t.text "recurrence", null: false
    t.bigint "service_user_id", null: false
    t.integer "staff_required", default: 1, null: false
    t.time "start_time", null: false
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.index ["service_user_id"], name: "index_care_package_slots_on_service_user_id"
    t.check_constraint "staff_required > 0 AND break_minutes >= 0", name: "shift_templates_positive"
  end

  create_table "care_plan_items", force: :cascade do |t|
    t.boolean "active", default: true, null: false
    t.text "category", null: false
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.text "detail"
    t.text "label", null: false
    t.integer "position", default: 0, null: false
    t.bigint "service_user_id", null: false
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.index ["service_user_id", "position"], name: "index_care_plan_items_on_service_user_id_and_position"
  end

  create_table "carer_requests", force: :cascade do |t|
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.timestamptz "decided_at"
    t.bigint "decided_by_admin_id"
    t.text "decision_note"
    t.text "detail"
    t.bigint "employee_id", null: false
    t.text "kind", null: false
    t.jsonb "payload", default: {}, null: false
    t.text "state", default: "pending", null: false
    t.text "summary", null: false
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.index ["employee_id"], name: "index_carer_requests_on_employee_id"
    t.index ["state", "created_at"], name: "index_carer_requests_on_state_and_created_at"
    t.check_constraint "kind = ANY (ARRAY['swap'::text, 'drop'::text, 'overtime'::text, 'availability'::text, 'leave'::text])", name: "carer_requests_kind_valid"
    t.check_constraint "state = ANY (ARRAY['pending'::text, 'approved'::text, 'declined'::text, 'cancelled'::text])", name: "carer_requests_state_valid"
  end

  create_table "clock_events", force: :cascade do |t|
    t.integer "accuracy_m"
    t.uuid "client_event_id", null: false
    t.bigint "corrects_id"
    t.bigint "created_by_id"
    t.text "created_by_type"
    t.uuid "device_fingerprint"
    t.integer "distance_from_site_m"
    t.enum "geofence_result", default: "not_checked", null: false, enum_type: "geofence_result"
    t.enum "kind", null: false, enum_type: "clock_kind"
    t.decimal "lat", precision: 10, scale: 7
    t.decimal "lng", precision: 10, scale: 7
    t.text "method", default: "gps", null: false
    t.timestamptz "occurred_at", null: false
    t.enum "origin", default: "live", null: false, enum_type: "clock_origin"
    t.text "reason"
    t.timestamptz "recorded_at", default: -> { "now()" }, null: false
    t.bigint "visit_assignment_id", null: false
    t.index ["client_event_id"], name: "index_clock_events_on_client_event_id", unique: true
    t.index ["corrects_id"], name: "idx_clock_events_corrects"
    t.index ["visit_assignment_id", "occurred_at"], name: "idx_clock_events_assignment"
    t.check_constraint "method <> 'manual_admin'::text OR reason IS NOT NULL", name: "clock_events_reason_when_manual"
  end

  create_table "conversation_participants", force: :cascade do |t|
    t.bigint "conversation_id", null: false
    t.timestamptz "joined_at", default: -> { "now()" }, null: false
    t.bigint "last_read_message_id"
    t.timestamptz "left_at"
    t.boolean "muted", default: false, null: false
    t.bigint "participant_id", null: false
    t.text "participant_type", null: false
    t.text "role", default: "member", null: false
    t.index ["conversation_id", "participant_type", "participant_id"], name: "idx_participants_unique", unique: true
    t.index ["participant_type", "participant_id"], name: "idx_participants_person", where: "(left_at IS NULL)"
  end

  create_table "conversations", force: :cascade do |t|
    t.boolean "auto_post", default: false, null: false
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.bigint "created_by_id"
    t.text "created_by_type"
    t.text "direct_key"
    t.enum "kind", null: false, enum_type: "conversation_kind"
    t.timestamptz "last_message_at"
    t.text "purpose"
    t.text "title"
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.index ["direct_key"], name: "index_conversations_on_direct_key", unique: true
    t.index ["last_message_at"], name: "idx_conversations_recent", order: :desc
    t.check_constraint "kind <> 'direct'::conversation_kind OR direct_key IS NOT NULL", name: "conversations_direct_key"
  end

  create_table "cover_offers", force: :cascade do |t|
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.bigint "employee_id", null: false
    t.text "note"
    t.timestamptz "offered_at", default: -> { "now()" }, null: false
    t.bigint "offered_by_admin_id"
    t.timestamptz "responded_at"
    t.text "state", default: "pending", null: false
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.bigint "visit_id", null: false
    t.index ["employee_id", "state"], name: "index_cover_offers_on_employee_id_and_state"
    t.index ["visit_id", "employee_id"], name: "idx_cover_offers_unique", unique: true
    t.index ["visit_id"], name: "index_cover_offers_on_visit_id"
    t.check_constraint "state = ANY (ARRAY['pending'::text, 'accepted'::text, 'declined'::text, 'withdrawn'::text])", name: "cover_offers_state_valid"
  end

  create_table "devices", force: :cascade do |t|
    t.text "app_version"
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.uuid "fingerprint", null: false
    t.timestamptz "last_seen_at"
    t.bigint "owner_id", null: false
    t.text "owner_type", null: false
    t.text "platform"
    t.jsonb "push_subscription"
    t.timestamptz "revoked_at"
    t.index ["fingerprint"], name: "index_devices_on_fingerprint", unique: true
    t.index ["owner_type", "owner_id"], name: "idx_devices_owner"
  end

  create_table "employee_availabilities", force: :cascade do |t|
    t.boolean "available", default: true, null: false
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.date "effective_from"
    t.date "effective_to"
    t.bigint "employee_id", null: false
    t.enum "slot", null: false, enum_type: "availability_slot"
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.integer "weekday", null: false
    t.index ["employee_id", "weekday", "slot"], name: "idx_employee_availability_unique", unique: true
    t.check_constraint "weekday >= 0 AND weekday <= 6", name: "employee_availability_weekday_range"
  end

  create_table "employees", force: :cascade do |t|
    t.timestamptz "accepted_invite_at"
    t.boolean "active", default: true, null: false
    t.decimal "contracted_hours_per_week", precision: 5, scale: 2
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.citext "email", null: false
    t.text "emergency_contact_name"
    t.text "emergency_contact_phone"
    t.text "employee_reference"
    t.text "encrypted_password", default: "", null: false
    t.integer "failed_attempts", default: 0, null: false
    t.text "first_name", null: false
    t.integer "hourly_rate_pence"
    t.timestamptz "invited_at"
    t.text "last_name", null: false
    t.timestamptz "last_sign_in_at"
    t.timestamptz "locked_at"
    t.text "mfa_backup_codes", default: [], null: false, array: true
    t.timestamptz "mfa_confirmed_at"
    t.boolean "mfa_enabled", default: false, null: false
    t.text "mfa_secret"
    t.integer "mileage_rate_pence"
    t.text "phone"
    t.timestamptz "reset_password_sent_at"
    t.string "reset_password_token"
    t.enum "role", default: "carer", null: false, enum_type: "employee_role"
    t.string "unlock_token"
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.string "webauthn_id"
    t.index ["active"], name: "idx_employees_active", where: "active"
    t.index ["email"], name: "index_employees_on_email", unique: true
    t.index ["reset_password_token"], name: "index_employees_on_reset_password_token", unique: true
    t.index ["unlock_token"], name: "index_employees_on_unlock_token", unique: true
    t.check_constraint "hourly_rate_pence IS NULL OR hourly_rate_pence >= 0", name: "employees_hourly_rate_non_negative"
    t.check_constraint "mileage_rate_pence IS NULL OR mileage_rate_pence >= 0", name: "employees_mileage_rate_non_negative"
  end

  create_table "events", force: :cascade do |t|
    t.bigint "actor_id"
    t.text "actor_type", null: false
    t.bigint "aggregate_id", null: false
    t.text "aggregate_type", null: false
    t.uuid "client_event_id"
    t.text "event_type", null: false
    t.timestamptz "occurred_at", null: false
    t.jsonb "payload", default: {}, null: false
    t.timestamptz "recorded_at", default: -> { "now()" }, null: false
    t.timestamptz "redacted_at"
    t.index ["aggregate_type", "aggregate_id"], name: "idx_events_aggregate"
    t.index ["client_event_id"], name: "index_events_on_client_event_id", unique: true
    t.index ["event_type", "occurred_at"], name: "idx_events_type", order: { occurred_at: :desc }
    t.index ["occurred_at"], name: "idx_events_time", order: :desc
  end

  create_table "jwt_denylist", force: :cascade do |t|
    t.timestamptz "exp", null: false
    t.string "jti", null: false
    t.index ["jti"], name: "index_jwt_denylist_on_jti"
  end

  create_table "message_attachments", force: :cascade do |t|
    t.bigint "byte_size"
    t.text "content_type"
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.text "filename", null: false
    t.bigint "message_id", null: false
    t.text "storage_key", null: false
  end

  create_table "message_receipts", force: :cascade do |t|
    t.timestamptz "delivered_at"
    t.bigint "message_id", null: false
    t.timestamptz "read_at"
    t.bigint "recipient_id", null: false
    t.text "recipient_type", null: false
    t.index ["message_id", "recipient_type", "recipient_id"], name: "idx_receipts_unique", unique: true
    t.index ["recipient_type", "recipient_id"], name: "idx_receipts_unread", where: "(read_at IS NULL)"
  end

  create_table "messages", force: :cascade do |t|
    t.text "body"
    t.boolean "broadcast", default: false, null: false
    t.uuid "client_message_id", null: false
    t.bigint "conversation_id", null: false
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.timestamptz "deleted_at"
    t.timestamptz "edited_at"
    t.timestamptz "pinned_at"
    t.bigint "pinned_by_id"
    t.text "pinned_by_type"
    t.bigint "sender_id"
    t.text "sender_type"
    t.boolean "system", default: false, null: false
    t.bigint "visit_id"
    t.index ["client_message_id"], name: "index_messages_on_client_message_id", unique: true
    t.index ["conversation_id", "created_at"], name: "idx_messages_conversation", order: { created_at: :desc }
    t.index ["conversation_id", "pinned_at"], name: "idx_messages_pinned", where: "(pinned_at IS NOT NULL)"
    t.index ["visit_id"], name: "index_messages_on_visit_id"
  end

  create_table "mileage_claims", force: :cascade do |t|
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.bigint "employee_id", null: false
    t.text "from_label"
    t.decimal "miles", precision: 6, scale: 2, null: false
    t.text "source", default: "carer", null: false
    t.text "state", default: "claimed", null: false
    t.text "to_label"
    t.date "travel_date", null: false
    t.bigint "visit_assignment_id"
    t.index ["employee_id", "travel_date"], name: "index_mileage_claims_on_employee_id_and_travel_date"
    t.index ["visit_assignment_id"], name: "index_mileage_claims_on_visit_assignment_id"
    t.check_constraint "miles >= 0::numeric", name: "mileage_non_negative"
  end

  create_table "notification_preferences", force: :cascade do |t|
    t.boolean "email", default: false, null: false
    t.boolean "in_app", default: true, null: false
    t.text "notification_type", null: false
    t.bigint "owner_id", null: false
    t.text "owner_type", null: false
    t.boolean "push", default: true, null: false
    t.index ["owner_type", "owner_id", "notification_type"], name: "idx_notification_prefs_unique", unique: true
  end

  create_table "notifications", force: :cascade do |t|
    t.bigint "alert_id"
    t.text "body"
    t.text "channel", null: false
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.timestamptz "delivered_at"
    t.text "failed_reason"
    t.text "notification_type", null: false
    t.bigint "recipient_id", null: false
    t.text "recipient_type", null: false
    t.timestamptz "seen_at"
    t.timestamptz "sent_at"
    t.text "status", default: "queued", null: false
    t.bigint "subject_id"
    t.text "subject_type"
    t.text "title", null: false
    t.index ["recipient_type", "recipient_id", "created_at"], name: "idx_notifications_recipient", order: { created_at: :desc }
    t.index ["recipient_type", "recipient_id"], name: "idx_notifications_unseen", where: "((seen_at IS NULL) AND (channel = 'in_app'::text))"
  end

  create_table "refresh_tokens", force: :cascade do |t|
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.bigint "device_id"
    t.timestamptz "expires_at", null: false
    t.bigint "owner_id", null: false
    t.text "owner_type", null: false
    t.timestamptz "revoked_at"
    t.text "token_digest", null: false
    t.index ["owner_type", "owner_id"], name: "idx_refresh_owner"
  end

  create_table "service_users", force: :cascade do |t|
    t.text "access_notes"
    t.boolean "active", default: true, null: false
    t.text "address_line1"
    t.text "address_line2"
    t.text "city"
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.date "date_of_birth"
    t.text "first_name", null: false
    t.text "geofence_mode"
    t.integer "geofence_radius_m", default: 150, null: false
    t.text "last_name", null: false
    t.decimal "lat", precision: 10, scale: 7
    t.decimal "lng", precision: 10, scale: 7
    t.text "phone"
    t.text "postcode"
    t.text "reference"
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.index ["active"], name: "idx_service_users_active", where: "active"
  end

  create_table "settings", id: :integer, default: 1, force: :cascade do |t|
    t.text "address_line1"
    t.text "address_line2"
    t.integer "auto_close_after_minutes", default: 240, null: false
    t.text "brand_primary_colour"
    t.integer "checkin_window_before_start_minutes", default: 15, null: false
    t.text "city"
    t.integer "clock_skew_tolerance_minutes", default: 10, null: false
    t.text "company_name", null: false
    t.text "cqc_location_id"
    t.text "cqc_provider_id"
    t.text "currency_code", default: "GBP", null: false
    t.integer "early_leave_tolerance_minutes", default: 10, null: false
    t.text "email"
    t.jsonb "extra", default: {}, null: false
    t.text "geofence_mode", default: "block", null: false
    t.integer "geofence_radius_m", default: 150, null: false
    t.integer "late_grace_minutes", default: 15, null: false
    t.text "logo_key"
    t.integer "missed_threshold_minutes", default: 30, null: false
    t.jsonb "modules_enabled", default: {"shifts" => true}, null: false
    t.integer "overdue_threshold_minutes", default: 60, null: false
    t.text "phone"
    t.jsonb "policy", default: {}, null: false
    t.text "postcode"
    t.text "timesheet_period", default: "weekly", null: false
    t.integer "timesheet_rounding_minutes", default: 0, null: false
    t.integer "timesheet_week_starts_on", default: 1, null: false
    t.text "timezone", default: "Europe/London", null: false
    t.text "trading_name"
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.check_constraint "id = 1", name: "settings_single_row"
  end

  create_table "solid_cable_messages", force: :cascade do |t|
    t.binary "channel", null: false
    t.bigint "channel_hash", null: false
    t.datetime "created_at", null: false
    t.binary "payload", null: false
    t.index ["channel"], name: "index_solid_cable_messages_on_channel"
    t.index ["channel_hash"], name: "index_solid_cable_messages_on_channel_hash"
    t.index ["created_at"], name: "index_solid_cable_messages_on_created_at"
  end

  create_table "solid_cache_entries", force: :cascade do |t|
    t.integer "byte_size", null: false
    t.datetime "created_at", null: false
    t.binary "key", null: false
    t.bigint "key_hash", null: false
    t.binary "value", null: false
    t.index ["byte_size"], name: "index_solid_cache_entries_on_byte_size"
    t.index ["key_hash", "byte_size"], name: "index_solid_cache_entries_on_key_hash_and_byte_size"
    t.index ["key_hash"], name: "index_solid_cache_entries_on_key_hash", unique: true
  end

  create_table "solid_queue_blocked_executions", force: :cascade do |t|
    t.string "concurrency_key", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "error"
    t.bigint "job_id", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", force: :cascade do |t|
    t.string "active_job_id"
    t.text "arguments"
    t.string "class_name", null: false
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "finished_at"
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at"
    t.datetime "updated_at", null: false
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "queue_name", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "hostname"
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.text "metadata"
    t.string "name", null: false
    t.integer "pid", null: false
    t.bigint "supervisor_id"
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.datetime "run_at", null: false
    t.string "task_key", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", force: :cascade do |t|
    t.text "arguments"
    t.string "class_name"
    t.string "command", limit: 2048
    t.datetime "created_at", null: false
    t.text "description"
    t.string "key", null: false
    t.integer "priority", default: 0
    t.string "queue_name"
    t.string "schedule", null: false
    t.boolean "static", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.integer "value", default: 1, null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "timesheet_disputes", force: :cascade do |t|
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.bigint "raised_by_employee_id", null: false
    t.text "reason", null: false
    t.text "resolution_note"
    t.bigint "resolved_by_admin_id"
    t.text "state", default: "open", null: false
    t.bigint "timesheet_line_id", null: false
  end

  create_table "timesheet_lines", force: :cascade do |t|
    t.timestamptz "approved_at"
    t.bigint "approved_by_admin_id"
    t.integer "break_minutes", default: 0, null: false
    t.bigint "employee_id", null: false
    t.text "flags", default: [], null: false, array: true
    t.integer "scheduled_minutes", null: false
    t.bigint "timesheet_period_id", null: false
    t.bigint "visit_assignment_id", null: false
    t.date "work_date", null: false
    t.integer "worked_minutes", null: false
    t.index ["approved_by_admin_id"], name: "index_timesheet_lines_on_approved_by_admin_id"
    t.index ["employee_id", "work_date"], name: "idx_timesheet_lines_employee"
    t.index ["timesheet_period_id", "visit_assignment_id"], name: "idx_on_timesheet_period_id_visit_assignment_id_57b4ac0514", unique: true
  end

  create_table "timesheet_periods", force: :cascade do |t|
    t.timestamptz "approved_at"
    t.bigint "approved_by_admin_id"
    t.date "ends_on", null: false
    t.timestamptz "locked_at"
    t.date "starts_on", null: false
    t.string "status", default: "open", null: false
    t.index ["starts_on"], name: "index_timesheet_periods_on_starts_on", unique: true
    t.check_constraint "ends_on >= starts_on", name: "timesheet_periods_range"
  end

  create_table "visit_assignments", force: :cascade do |t|
    t.timestamptz "actual_end"
    t.timestamptz "actual_start"
    t.bigint "assigned_by_admin_id"
    t.text "assignment_status", default: "assigned", null: false
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.bigint "employee_id", null: false
    t.text "flags", default: [], null: false, array: true
    t.enum "lifecycle_state", default: "scheduled", null: false, enum_type: "lifecycle_state"
    t.text "override_reason"
    t.text "role", default: "worker", null: false
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.bigint "visit_id", null: false
    t.integer "worked_minutes"
    t.index ["employee_id", "lifecycle_state"], name: "idx_assignments_employee"
    t.index ["lifecycle_state"], name: "idx_assignments_state"
    t.index ["visit_id", "employee_id"], name: "idx_assignments_unique", unique: true, where: "(assignment_status = 'assigned'::text)"
  end

  create_table "visit_notes", force: :cascade do |t|
    t.bigint "author_id", null: false
    t.string "author_type", null: false
    t.text "body", null: false
    t.uuid "client_note_id", null: false
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.bigint "supersedes_id"
    t.bigint "visit_assignment_id", null: false
    t.index ["author_type", "author_id"], name: "index_visit_notes_on_author"
    t.index ["client_note_id"], name: "index_visit_notes_on_client_note_id", unique: true
    t.index ["visit_assignment_id", "created_at"], name: "index_visit_notes_on_visit_assignment_id_and_created_at"
  end

  create_table "visit_tasks", force: :cascade do |t|
    t.bigint "care_plan_item_id"
    t.timestamptz "completed_at"
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.boolean "done", default: false, null: false
    t.text "label", null: false
    t.bigint "visit_assignment_id", null: false
    t.index ["care_plan_item_id"], name: "index_visit_tasks_on_care_plan_item_id"
    t.index ["visit_assignment_id", "care_plan_item_id"], name: "idx_visit_tasks_unique_care_plan", unique: true, where: "(care_plan_item_id IS NOT NULL)"
    t.index ["visit_assignment_id"], name: "index_visit_tasks_on_visit_assignment_id"
  end

  create_table "visits", force: :cascade do |t|
    t.integer "break_minutes", default: 0, null: false
    t.text "cancellation_reason"
    t.timestamptz "cancelled_at"
    t.bigint "care_package_slot_id"
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.text "notes"
    t.timestamptz "published_at"
    t.bigint "published_by_admin_id"
    t.timestamptz "scheduled_end", null: false
    t.timestamptz "scheduled_start", null: false
    t.bigint "service_user_id", null: false
    t.integer "staff_required", default: 1, null: false
    t.enum "status", default: "draft", null: false, enum_type: "shift_status"
    t.timestamptz "updated_at", default: -> { "now()" }, null: false
    t.index ["care_package_slot_id", "scheduled_start"], name: "idx_shifts_template_slot", unique: true, where: "(care_package_slot_id IS NOT NULL)"
    t.index ["scheduled_start"], name: "idx_shifts_start"
    t.index ["service_user_id"], name: "index_visits_on_service_user_id"
    t.index ["status", "scheduled_start"], name: "idx_shifts_status"
    t.check_constraint "scheduled_end > scheduled_start", name: "shifts_end_after_start"
  end

  create_table "webauthn_credentials", force: :cascade do |t|
    t.timestamptz "created_at", default: -> { "now()" }, null: false
    t.string "external_id", null: false
    t.timestamptz "last_used_at"
    t.text "nickname"
    t.bigint "owner_id", null: false
    t.text "owner_type", null: false
    t.text "public_key", null: false
    t.bigint "sign_count", default: 0, null: false
    t.index ["external_id"], name: "index_webauthn_credentials_on_external_id", unique: true
    t.index ["owner_type", "owner_id"], name: "idx_webauthn_credentials_owner"
  end

  add_foreign_key "active_storage_attachments", "active_storage_blobs", column: "blob_id"
  add_foreign_key "active_storage_variant_records", "active_storage_blobs", column: "blob_id"
  add_foreign_key "alerts", "admins", column: "acknowledged_by_admin_id"
  add_foreign_key "care_package_slots", "service_users"
  add_foreign_key "care_plan_items", "service_users"
  add_foreign_key "carer_requests", "admins", column: "decided_by_admin_id"
  add_foreign_key "carer_requests", "employees"
  add_foreign_key "clock_events", "clock_events", column: "corrects_id"
  add_foreign_key "clock_events", "visit_assignments"
  add_foreign_key "conversation_participants", "conversations"
  add_foreign_key "cover_offers", "admins", column: "offered_by_admin_id"
  add_foreign_key "cover_offers", "employees"
  add_foreign_key "cover_offers", "visits"
  add_foreign_key "employee_availabilities", "employees"
  add_foreign_key "message_attachments", "messages"
  add_foreign_key "message_receipts", "messages"
  add_foreign_key "messages", "conversations"
  add_foreign_key "mileage_claims", "employees"
  add_foreign_key "mileage_claims", "visit_assignments"
  add_foreign_key "notifications", "alerts"
  add_foreign_key "refresh_tokens", "devices"
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "timesheet_disputes", "admins", column: "resolved_by_admin_id"
  add_foreign_key "timesheet_disputes", "employees", column: "raised_by_employee_id"
  add_foreign_key "timesheet_disputes", "timesheet_lines"
  add_foreign_key "timesheet_lines", "admins", column: "approved_by_admin_id"
  add_foreign_key "timesheet_lines", "employees"
  add_foreign_key "timesheet_lines", "timesheet_periods"
  add_foreign_key "timesheet_lines", "visit_assignments"
  add_foreign_key "timesheet_periods", "admins", column: "approved_by_admin_id"
  add_foreign_key "visit_assignments", "admins", column: "assigned_by_admin_id"
  add_foreign_key "visit_assignments", "employees"
  add_foreign_key "visit_assignments", "visits"
  add_foreign_key "visit_notes", "visit_assignments"
  add_foreign_key "visit_notes", "visit_notes", column: "supersedes_id"
  add_foreign_key "visit_tasks", "care_plan_items"
  add_foreign_key "visit_tasks", "visit_assignments"
  add_foreign_key "visits", "admins", column: "published_by_admin_id"
  add_foreign_key "visits", "care_package_slots"
  add_foreign_key "visits", "service_users"
end
