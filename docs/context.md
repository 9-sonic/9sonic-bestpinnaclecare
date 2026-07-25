# Best Pinnacle Care — Phase 1 Build Context

> Single-file context for an LLM to build **Phase 1 only** (week 1).
> Scope: foundation + shifts, rotas, clocking, timesheets, staff chat.
> Out of scope for Phase 1: service users, visits, eMAR, HR, finance, care planning.

---

## 1. What this is

A care-management app for **Best Pinnacle Care**, a UK domiciliary (home-care) provider. Phase 1 delivers staff **shift scheduling and clock in/out** — the office builds a rota, carers see it on their phones, clock in and out with GPS + time captured, and hours flow into approvable timesheets. Staff-only chat ships alongside.

**Deployment:** single-tenant. This codebase runs as one instance for Best Pinnacle on their own server (Virtualmin), own database, own resources. **There is no `organisation_id`, no multi-tenancy, no row-level security.** One install = one provider. All provider configuration lives in a single-row `settings` table, editable in-app.

## 2. Stack

- **Backend:** Rails 8, **API-only** (no views, no Hotwire). Ruby 3.4, PostgreSQL 17.
- **Frontend:** React 19 + TypeScript, Vite, one SPA with `/admin` (office) and `/staff` (carer PWA) routes. TanStack Query, React Router, Tailwind, Dexie for the offline outbox.
- **Jobs/cache/cable:** SolidQueue, SolidCache, SolidCable (all Postgres-backed).
- **Auth:** JWT (15-min access + rotating refresh bound to device). MFA required for admin roles; optional for carers. **Separate login endpoints** — `POST /api/v1/admin/auth/login` (office) and `POST /api/v1/staff/auth/login` (carer), each with its own login screen. Each endpoint rejects the wrong audience with 403: the admin endpoint refuses carers, the carer endpoint refuses office roles. Refresh and logout are shared.
- **Deploy:** Kamal 2 to the UK Virtualmin host. Timezone `Europe/London`.

## 3. Non-negotiable behavioural rules

1. **Append-only audit.** `clock_events` and `events` never update or delete (enforced by Postgres RULEs + REVOKE). A manager correcting a clock time inserts a **new** `clock_event` with `corrects_id` → the original and a mandatory `reason`. The original stays visible forever. The `effective_clock_events` view resolves the chain.
2. **One writer to `events`.** `Events::Record.call` is the only insert path, called inside the same transaction as the change it describes. Every state change of consequence writes one.
3. **Idempotency.** Every carer-originated mutation carries a client-generated UUID (`client_event_id`), unique-constrained. A retry after a dropped connection cannot double-record. Applies to clock events and chat messages.
4. **Device time is honest.** `occurred_at` = when the carer tapped (device clock, offline-aware). `recorded_at` = when the server received it. A device clock more than `clock_skew_tolerance_minutes` off is flagged `time_anomaly` and routed to review, never silently discarded.
5. **Server owns the truth.** Geofence result, lifecycle state, and worked-minutes are computed server-side. The client's geofence result is never trusted.
6. **Clocking must not go down at 06:45.** Zero-downtime deploys; the offline outbox absorbs brief outages.

## 4. Geofence rule (clock-in)

Provider default `geofence_mode = 'block'`, `geofence_radius_m = 150`:

- **Within 150 m of the location, GPS fix present** → clock-in succeeds, `geofence_result = 'pass'`.
- **Outside 150 m, GPS fix present** → clock-in **blocked**, `geofence_result = 'fail'`, no clock event written. UI: "You're too far from the location to start."
- **No GPS fix at all** → clock-in **allowed**, `geofence_result = 'no_fix'`, raises a `geo_anomaly` alert to the office exceptions queue. Care recording is never blocked by a dead GPS chip.
- **Genuinely stuck outside** → office authorises remotely via a `manual_admin` clock event with reason (the correction path).

## 5. Shift lifecycle state machine

Timer-driven FSM on `shift_assignments.lifecycle_state`, advanced by a **1-minute** SolidQueue job (`Lifecycle::EvaluateStatesJob`). Thresholds come from `settings`.

```
scheduled
   │ T − checkin_window_before_start_minutes (default 15)
   ▼
check_in_window ──valid clock_in──────────────────────────► in_progress
   │                                                            │
   │ scheduled_start passed, no clock_in                        │ valid clock_out
   ▼                                                            ▼
grace_period ──clock_in within grace──► late ──clock_out──► completed
   │ (late is a flag-bearing path into in_progress)
   │ grace expired (missed_threshold_minutes, default 30), no clock_in
   ▼
missed

in_progress ──scheduled_end + overdue_threshold (default 60)──► overdue
overdue ──valid clock_out──► completed (flagged)
overdue / grace_period ──anomaly (geo/time/no clock_out)──► pending_review
pending_review ──coordinator confirms valid──► completed
pending_review ──coordinator confirms failed──► missed
in_progress ──scheduled_end + auto_close_after (default 240)──► auto clock-out, flag 'auto_closed', blocks timesheet approval until manager confirms
any ──authorised cancel──► cancelled
```

Alert suppression is a requirement: don't re-raise an alert already open for the same subject+type; respect the cooldown. False-positive SMS/email alerts cost money and erode trust.

---

## 5a. Notifications — how people get told

Two concepts, kept separate on purpose:

- **Alert** = an operational condition the office must act on (a carer is late, a shift was missed). Lives in `alerts`. Has an acknowledge/resolve lifecycle.
- **Notification** = one delivery of a message to one person on one channel. Lives in `notifications`. An alert fans out into several notifications; a chat message produces a notification with **no** alert.

### Channels

| Channel | Mechanism | Reaches user when… |
|---|---|---|
| `in_app` | Server broadcasts over WebSocket (ActionCable/SolidCable) to `NotificationsChannel`; the bell updates live, no refresh | app is open |
| `push` | Web Push (VAPID) to the registered device; shows on lock screen | app is closed (needs one-time permission; PWA-limited on iOS) |
| `email` | ActionMailer, queued via SolidQueue | anytime; used for waitable items + fallback |

### What fires, to whom, on which channels (Phase 1)

| Trigger | Recipients | Channels | Raises alert? |
|---|---|---|---|
| Rota published | carers on the rota | push + in_app | no |
| A carer's shift changed / cancelled | that carer | push + in_app | no |
| Shift assigned to a carer | that carer | in_app (push if within 24h) | no |
| **Missed shift** (no clock-in past threshold) | on-duty coordinators | in_app + push + live board | **yes** (`missed`) |
| **Late clock-in** | coordinators | in_app + live board | **yes** (`late`) |
| **No clock-out** past overdue | coordinators | in_app + push | **yes** (`no_clock_out`) |
| **Geofence blocked / no-GPS-fix** clock-in | coordinators | in_app (exceptions queue) | **yes** (`geo_anomaly`) |
| **Clock time correction** by office | the affected carer | in_app | no |
| Timesheet period ready to approve | managers | in_app + email | no |
| Timesheet dispute raised | coordinators | in_app | no |
| **New chat message** | conversation participants | in_app instantly; **push if still unread after 2 min** | no |

Note: a carer clocking in does **not** notify themselves — they see on-screen confirmation. Clock notifications flow to the office.

### Delivery pipeline (one path for everything)

```
condition happens
   │
   ├─ shift/clock condition → Alerts::Raise (dedupe + cooldown) ─┐
   │                                                             │
   └─ chat message ─────────────────────────────────────────────┤
                                                                 ▼
                                                     Notifications::Deliver
                                                                 │
                        Notifications::ResolveRecipients (role-aware)
                                                                 │
                    per recipient: check NotificationPreference per channel
                                                                 │
                        writes one `notifications` row per enabled channel
                                                                 ▼
              ┌───────────────┬───────────────────┬──────────────────┐
        InAppChannel      PushChannel         EmailChannel
        broadcast WS      Web Push (VAPID)    ActionMailer + SolidQueue
              │                 │                     │
        status=delivered   status=sent/failed   status=sent/failed
```

- **Delivery is idempotent per (alert/message, user, channel)** — re-running the deliver job won't double-send.
- **Preferences win.** `notification_preferences` is per-user, per-type, per-channel. Defaults: in_app on, push on, email off — except timesheet-ready which defaults email on for managers. Safety-critical office alerts (missed shift, no clock-out) ignore the off-switch for in_app so they can't be silenced.
- **Retry.** A failed push/email is retried by `Notifications::RetryFailedJob`; after final failure the row is marked `failed` and, for a critical alert, it falls back to email.
- **Unread-push debounce.** `Messaging::NotifyUnreadJob` runs ~2 min after a message; if the recipient still hasn't read it (no `message_receipt.read_at`), it sends a push. This stops a push firing while they're actively reading the thread.

### Reliability note (PWA)

Web Push works on the carer PWA but is weaker than native, especially iOS (requires Add-to-Home-Screen, background delivery is unreliable). Phase 1 relies on in_app (guaranteed when open) + push (best-effort when closed). This is acceptable because carers open the app to see their rota; if lock-screen delivery must be guaranteed every time, that's the native-app decision, out of scope here.

---

## 6. Schema — Phase 1 (PostgreSQL 17)

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- ---- Settings: single row, editable in-app --------------------------
CREATE TABLE settings (
    id                    integer PRIMARY KEY DEFAULT 1,
    company_name          text NOT NULL,
    trading_name          text,
    cqc_provider_id       text,
    cqc_location_id       text,
    address_line1 text, address_line2 text, city text, postcode text,
    phone text, email text,
    logo_key              text,
    brand_primary_colour  text,
    timezone              text NOT NULL DEFAULT 'Europe/London',
    currency_code         text NOT NULL DEFAULT 'GBP',
    checkin_window_before_start_minutes integer NOT NULL DEFAULT 15,
    late_grace_minutes            integer NOT NULL DEFAULT 5,
    missed_threshold_minutes      integer NOT NULL DEFAULT 30,
    overdue_threshold_minutes     integer NOT NULL DEFAULT 60,
    auto_close_after_minutes      integer NOT NULL DEFAULT 240,
    early_leave_tolerance_minutes integer NOT NULL DEFAULT 10,
    clock_skew_tolerance_minutes  integer NOT NULL DEFAULT 10,
    geofence_mode         text NOT NULL DEFAULT 'block',   -- off|warn|block
    geofence_radius_m     integer NOT NULL DEFAULT 150,
    timesheet_period      text NOT NULL DEFAULT 'weekly',  -- weekly|fortnightly|four_weekly
    timesheet_week_starts_on integer NOT NULL DEFAULT 1,   -- 1 = Monday
    timesheet_rounding_minutes integer NOT NULL DEFAULT 0, -- 0 = exact
    modules_enabled       jsonb NOT NULL DEFAULT '{"shifts":true}'::jsonb,
    extra                 jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at            timestamptz NOT NULL DEFAULT now(),
    CHECK (id = 1)
);

-- ---- Identity -------------------------------------------------------
CREATE TYPE role_name AS ENUM
    ('registered_manager','manager','coordinator','carer','finance','auditor');

CREATE TABLE users (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email               citext NOT NULL UNIQUE,
    password_digest     text,
    first_name          text NOT NULL,
    last_name           text NOT NULL,
    phone               text,
    role                role_name NOT NULL,
    mfa_secret          text,
    mfa_enabled         boolean NOT NULL DEFAULT false,
    failed_attempts     integer NOT NULL DEFAULT 0,
    locked_at           timestamptz,
    invited_at          timestamptz,
    accepted_invite_at  timestamptz,
    last_sign_in_at     timestamptz,
    active              boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_users_active ON users(active) WHERE active;

CREATE TABLE devices (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             bigint NOT NULL REFERENCES users(id),
    fingerprint         uuid NOT NULL UNIQUE,
    platform            text,
    app_version         text,
    push_subscription   jsonb,
    last_seen_at        timestamptz,
    revoked_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             bigint NOT NULL REFERENCES users(id),
    device_id           bigint REFERENCES devices(id),
    token_digest        text NOT NULL,
    expires_at          timestamptz NOT NULL,
    revoked_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- ---- Event log (append-only) ---------------------------------------
CREATE TABLE events (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type          text NOT NULL,
    aggregate_type      text NOT NULL,
    aggregate_id        bigint NOT NULL,
    actor_type          text NOT NULL,        -- User | System
    actor_id            bigint,
    payload             jsonb NOT NULL DEFAULT '{}'::jsonb,
    redacted_at         timestamptz,
    occurred_at         timestamptz NOT NULL,
    recorded_at         timestamptz NOT NULL DEFAULT now(),
    client_event_id     uuid UNIQUE
);
CREATE INDEX idx_events_time ON events(occurred_at DESC);
CREATE INDEX idx_events_aggregate ON events(aggregate_type, aggregate_id);
CREATE INDEX idx_events_type ON events(event_type, occurred_at DESC);
CREATE RULE events_no_update AS ON UPDATE TO events DO INSTEAD NOTHING;
CREATE RULE events_no_delete AS ON DELETE TO events DO INSTEAD NOTHING;

-- ---- Locations ------------------------------------------------------
CREATE TABLE locations (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name                text NOT NULL,
    address_line1 text, address_line2 text, city text, postcode text,
    lat numeric(10,7), lng numeric(10,7),
    geofence_radius_m   integer,        -- NULL = settings default
    geofence_mode       text,           -- NULL = settings default
    active              boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- ---- Shifts & rotas -------------------------------------------------
CREATE TABLE shift_templates (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    location_id         bigint REFERENCES locations(id),
    name                text NOT NULL,
    start_time          time NOT NULL,
    end_time            time NOT NULL,          -- end < start ⇒ crosses midnight
    recurrence          text NOT NULL,          -- RRULE
    staff_required      integer NOT NULL DEFAULT 1,
    break_minutes       integer NOT NULL DEFAULT 0,
    effective_from      date NOT NULL,
    effective_to        date,
    active              boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (staff_required > 0 AND break_minutes >= 0)
);

CREATE TYPE shift_status AS ENUM ('draft','published','cancelled');

CREATE TABLE shifts (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shift_template_id   bigint REFERENCES shift_templates(id),  -- NULL = ad-hoc
    location_id         bigint REFERENCES locations(id),
    scheduled_start     timestamptz NOT NULL,
    scheduled_end       timestamptz NOT NULL,
    break_minutes       integer NOT NULL DEFAULT 0,   -- snapshot
    staff_required      integer NOT NULL DEFAULT 1,   -- snapshot
    status              shift_status NOT NULL DEFAULT 'draft',
    published_at        timestamptz,
    cancelled_at        timestamptz,
    cancellation_reason text,
    notes               text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (scheduled_end > scheduled_start)
);
CREATE INDEX idx_shifts_start ON shifts(scheduled_start);
CREATE INDEX idx_shifts_status ON shifts(status, scheduled_start);
CREATE UNIQUE INDEX idx_shifts_template_slot
    ON shifts(shift_template_id, scheduled_start)
    WHERE shift_template_id IS NOT NULL;

CREATE TYPE lifecycle_state AS ENUM (
    'scheduled','check_in_window','grace_period','late','in_progress',
    'overdue','pending_review','completed','missed','cancelled'
);

CREATE TABLE shift_assignments (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shift_id            bigint NOT NULL REFERENCES shifts(id),
    user_id             bigint NOT NULL REFERENCES users(id),
    role                text NOT NULL DEFAULT 'worker',   -- worker|supervisor|shadow
    assignment_status   text NOT NULL DEFAULT 'assigned', -- assigned|withdrawn
    lifecycle_state     lifecycle_state NOT NULL DEFAULT 'scheduled',
    actual_start        timestamptz,
    actual_end          timestamptz,
    worked_minutes      integer,
    flags               text[] NOT NULL DEFAULT '{}',
    override_reason     text,
    assigned_by_user_id bigint REFERENCES users(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_assignments_unique
    ON shift_assignments(shift_id, user_id) WHERE assignment_status = 'assigned';
CREATE INDEX idx_assignments_user ON shift_assignments(user_id, lifecycle_state);
CREATE INDEX idx_assignments_state ON shift_assignments(lifecycle_state);

-- ---- Clock events (append-only, correction chain) ------------------
CREATE TYPE clock_kind AS ENUM ('clock_in','clock_out');
CREATE TYPE geofence_result AS ENUM ('pass','fail','no_fix','not_checked');

CREATE TABLE clock_events (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shift_assignment_id   bigint NOT NULL REFERENCES shift_assignments(id),
    kind                  clock_kind NOT NULL,
    occurred_at           timestamptz NOT NULL,
    recorded_at           timestamptz NOT NULL DEFAULT now(),
    method                text NOT NULL DEFAULT 'gps',  -- gps|manual_admin
    lat numeric(10,7), lng numeric(10,7), accuracy_m integer,
    geofence_result       geofence_result NOT NULL DEFAULT 'not_checked',
    distance_from_site_m  integer,
    device_fingerprint    uuid,
    client_event_id       uuid NOT NULL UNIQUE,
    reason                text,                   -- required if manual_admin
    corrects_id           bigint REFERENCES clock_events(id),
    created_by_user_id    bigint REFERENCES users(id),
    CHECK (method <> 'manual_admin' OR reason IS NOT NULL)
);
CREATE INDEX idx_clock_events_assignment ON clock_events(shift_assignment_id, occurred_at);
CREATE INDEX idx_clock_events_corrects ON clock_events(corrects_id);
CREATE RULE clock_events_no_update AS ON UPDATE TO clock_events DO INSTEAD NOTHING;
CREATE RULE clock_events_no_delete AS ON DELETE TO clock_events DO INSTEAD NOTHING;

CREATE VIEW effective_clock_events AS
SELECT ce.* FROM clock_events ce
WHERE NOT EXISTS (SELECT 1 FROM clock_events c2 WHERE c2.corrects_id = ce.id);

-- ---- Alerts ---------------------------------------------------------
CREATE TYPE alert_state AS ENUM ('open','acknowledged','resolved');

CREATE TABLE alerts (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alert_type          text NOT NULL,        -- late|missed|overdue|no_clock_out|geo_anomaly|time_anomaly
    subject_type        text NOT NULL,
    subject_id          bigint NOT NULL,
    severity            text NOT NULL DEFAULT 'normal',
    raised_at           timestamptz NOT NULL DEFAULT now(),
    state               alert_state NOT NULL DEFAULT 'open',
    acknowledged_by     bigint REFERENCES users(id),
    acknowledged_at     timestamptz,
    resolved_at         timestamptz,
    resolution_note     text
);
CREATE UNIQUE INDEX idx_alerts_dedupe
    ON alerts(subject_type, subject_id, alert_type) WHERE state = 'open';
CREATE INDEX idx_alerts_open ON alerts(state, raised_at DESC);

-- ---- Timesheets -----------------------------------------------------
CREATE TABLE timesheet_periods (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    starts_on           date NOT NULL UNIQUE,
    ends_on             date NOT NULL,
    status              text NOT NULL DEFAULT 'open',  -- open|approved|locked
    approved_by         bigint REFERENCES users(id),
    approved_at         timestamptz,
    locked_at           timestamptz,
    CHECK (ends_on >= starts_on)
);

CREATE TABLE timesheet_lines (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timesheet_period_id   bigint NOT NULL REFERENCES timesheet_periods(id),
    user_id               bigint NOT NULL REFERENCES users(id),
    shift_assignment_id   bigint NOT NULL REFERENCES shift_assignments(id),
    work_date             date NOT NULL,        -- overnight ⇒ shift START date
    scheduled_minutes     integer NOT NULL,
    worked_minutes        integer NOT NULL,     -- exact; rounding at export
    break_minutes         integer NOT NULL DEFAULT 0,
    flags                 text[] NOT NULL DEFAULT '{}',
    UNIQUE (timesheet_period_id, shift_assignment_id)
);
CREATE INDEX idx_timesheet_lines_user ON timesheet_lines(user_id, work_date);

CREATE TABLE timesheet_disputes (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timesheet_line_id   bigint NOT NULL REFERENCES timesheet_lines(id),
    raised_by           bigint NOT NULL REFERENCES users(id),
    reason              text NOT NULL,
    state               text NOT NULL DEFAULT 'open',
    resolved_by         bigint REFERENCES users(id),
    resolution_note     text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- ---- Messaging (staff-only chat: 1-to-1 and group) -----------------
CREATE TYPE conversation_kind AS ENUM ('direct','group');

CREATE TABLE conversations (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind                conversation_kind NOT NULL,
    title               text,
    direct_key          text UNIQUE,          -- sorted user-id pair, dedupes 1-to-1
    created_by          bigint REFERENCES users(id),
    last_message_at     timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (kind <> 'direct' OR direct_key IS NOT NULL)
);
CREATE INDEX idx_conversations_recent ON conversations(last_message_at DESC NULLS LAST);

CREATE TABLE conversation_participants (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id     bigint NOT NULL REFERENCES conversations(id),
    user_id             bigint NOT NULL REFERENCES users(id),
    role                text NOT NULL DEFAULT 'member',
    joined_at           timestamptz NOT NULL DEFAULT now(),
    left_at             timestamptz,
    muted               boolean NOT NULL DEFAULT false,
    last_read_message_id bigint,
    UNIQUE (conversation_id, user_id)
);
CREATE INDEX idx_participants_user ON conversation_participants(user_id) WHERE left_at IS NULL;

CREATE TABLE messages (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id     bigint NOT NULL REFERENCES conversations(id),
    sender_id           bigint NOT NULL REFERENCES users(id),
    body                text,
    client_message_id   uuid NOT NULL UNIQUE,  -- idempotent send
    edited_at           timestamptz,
    deleted_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);

CREATE TABLE message_attachments (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id          bigint NOT NULL REFERENCES messages(id),
    filename            text NOT NULL,
    storage_key         text NOT NULL,
    content_type        text,
    byte_size           bigint,
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE message_receipts (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message_id          bigint NOT NULL REFERENCES messages(id),
    user_id             bigint NOT NULL REFERENCES users(id),
    delivered_at        timestamptz,
    read_at             timestamptz,
    UNIQUE (message_id, user_id)
);
CREATE INDEX idx_receipts_unread ON message_receipts(user_id) WHERE read_at IS NULL;

-- ---- Notifications --------------------------------------------------
CREATE TABLE notifications (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             bigint NOT NULL REFERENCES users(id),
    notification_type   text NOT NULL,        -- alert|message|system
    alert_id            bigint REFERENCES alerts(id),
    subject_type        text,
    subject_id          bigint,
    title               text NOT NULL,
    body                text,
    channel             text NOT NULL,        -- in_app|push|email
    status              text NOT NULL DEFAULT 'queued',
    sent_at timestamptz, delivered_at timestamptz, seen_at timestamptz,
    failed_reason       text,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unseen
    ON notifications(user_id) WHERE seen_at IS NULL AND channel = 'in_app';

CREATE TABLE notification_preferences (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id             bigint NOT NULL REFERENCES users(id),
    notification_type   text NOT NULL,
    in_app              boolean NOT NULL DEFAULT true,
    push                boolean NOT NULL DEFAULT true,
    email               boolean NOT NULL DEFAULT false,
    UNIQUE (user_id, notification_type)
);

-- Seed: the single settings row
-- INSERT INTO settings (id, company_name) VALUES (1, 'Best Pinnacle Care Ltd');
```

---

## 7. Models — Phase 1 (ActiveRecord)

```ruby
# app/models/concerns/append_only.rb
module AppendOnly
  extend ActiveSupport::Concern
  included do
    before_update  { raise ActiveRecord::ReadOnlyRecord, "#{self.class} is append-only" }
    before_destroy { raise ActiveRecord::ReadOnlyRecord, "#{self.class} is append-only" }
  end
end

# app/models/concerns/auditable.rb
module Auditable
  extend ActiveSupport::Concern
  # Domain services call Events::Record; this concern exposes a helper.
  def record_event!(type, payload = {}, actor: Current.user, occurred_at: Time.current)
    Events::Record.call(event_type: type, aggregate: self, actor:, payload:, occurred_at:)
  end
end

# app/models/setting.rb
class Setting < ApplicationRecord
  def self.instance = first_or_create!(id: 1)
  def geofence_for(location) # location overrides fall back to settings
    { mode:   location&.geofence_mode   || geofence_mode,
      radius: location&.geofence_radius_m || geofence_radius_m }
  end
end

# app/models/user.rb
class User < ApplicationRecord
  has_secure_password validations: false
  enum :role, { registered_manager: 0, manager: 1, coordinator: 2,
                carer: 3, finance: 4, auditor: 5 }

  has_many :devices, dependent: :destroy
  has_many :refresh_tokens, dependent: :destroy
  has_many :shift_assignments, foreign_key: :user_id
  has_many :shifts, through: :shift_assignments
  has_many :clock_events, through: :shift_assignments
  has_many :timesheet_lines
  has_many :conversation_participants
  has_many :conversations, through: :conversation_participants
  has_many :sent_messages, class_name: "Message", foreign_key: :sender_id
  has_many :notifications, dependent: :destroy
  has_many :notification_preferences, dependent: :destroy

  scope :office, -> { where(role: %i[registered_manager manager coordinator finance auditor]) }
  scope :carers, -> { where(role: :carer) }
  def office? = !carer?
  def full_name = "#{first_name} #{last_name}"
end

# app/models/device.rb
class Device < ApplicationRecord
  belongs_to :user
  has_many   :refresh_tokens
  scope :active, -> { where(revoked_at: nil) }
  def revoked? = revoked_at.present?
end

# app/models/refresh_token.rb
class RefreshToken < ApplicationRecord
  belongs_to :user
  belongs_to :device, optional: true
  scope :active, -> { where(revoked_at: nil).where("expires_at > ?", Time.current) }
end

# app/models/event.rb
class Event < ApplicationRecord
  include AppendOnly
  belongs_to :aggregate, polymorphic: true
  belongs_to :actor, polymorphic: true, optional: true
end

# app/models/location.rb
class Location < ApplicationRecord
  has_many :shift_templates
  has_many :shifts
  scope :active, -> { where(active: true) }
end

# app/models/shift_template.rb
class ShiftTemplate < ApplicationRecord
  belongs_to :location, optional: true
  has_many   :shifts
  scope :active, -> { where(active: true) }
  # Overnight when end_time < start_time (crosses midnight).
end

# app/models/shift.rb
class Shift < ApplicationRecord
  include Auditable
  belongs_to :shift_template, optional: true
  belongs_to :location, optional: true
  has_many   :shift_assignments, dependent: :destroy
  has_many   :users, through: :shift_assignments

  enum :status, { draft: 0, published: 1, cancelled: 2 }
  scope :published, -> { where(status: :published) }
  scope :in_window, ->(from, to) { where(scheduled_start: from..to) }
  validates :scheduled_end, comparison: { greater_than: :scheduled_start }
end

# app/models/shift_assignment.rb
class ShiftAssignment < ApplicationRecord
  include Auditable
  belongs_to :shift
  belongs_to :user
  belongs_to :assigned_by, class_name: "User", foreign_key: :assigned_by_user_id, optional: true
  has_many   :clock_events, dependent: :restrict_with_error
  has_many   :alerts, as: :subject
  has_many   :timesheet_lines

  enum :lifecycle_state, {
    scheduled: 0, check_in_window: 1, grace_period: 2, late: 3,
    in_progress: 4, overdue: 5, pending_review: 6,
    completed: 7, missed: 8, cancelled: 9
  }
  scope :assigned, -> { where(assignment_status: "assigned") }
  scope :non_terminal, -> { where(lifecycle_state: %i[scheduled check_in_window grace_period late in_progress overdue pending_review]) }

  def effective_clock_in  = clock_events.effective.where(kind: :clock_in).order(:occurred_at).first
  def effective_clock_out = clock_events.effective.where(kind: :clock_out).order(:occurred_at).last
end

# app/models/clock_event.rb
class ClockEvent < ApplicationRecord
  include AppendOnly
  belongs_to :shift_assignment
  belongs_to :created_by, class_name: "User", foreign_key: :created_by_user_id, optional: true
  belongs_to :corrects, class_name: "ClockEvent", optional: true
  has_one    :corrected_by, class_name: "ClockEvent", foreign_key: :corrects_id

  enum :kind, { clock_in: 0, clock_out: 1 }
  enum :geofence_result, { pass: 0, fail: 1, no_fix: 2, not_checked: 3 }, prefix: :geo

  # rows nobody has superseded
  scope :effective, -> { where.not(id: ClockEvent.where.not(corrects_id: nil).select(:corrects_id)) }
  validates :reason, presence: true, if: -> { method == "manual_admin" }
end

# app/models/alert.rb
class Alert < ApplicationRecord
  belongs_to :subject, polymorphic: true
  belongs_to :acknowledged_by, class_name: "User", optional: true
  has_many   :notifications
  enum :state, { open: 0, acknowledged: 1, resolved: 2 }
  scope :open_for, ->(s) { where(subject: s, state: :open) }
end

# app/models/timesheet_period.rb
class TimesheetPeriod < ApplicationRecord
  has_many   :timesheet_lines, dependent: :destroy
  belongs_to :approved_by, class_name: "User", optional: true
  enum :status, { open: "open", approved: "approved", locked: "locked" }, default: "open"
end

# app/models/timesheet_line.rb
class TimesheetLine < ApplicationRecord
  belongs_to :timesheet_period
  belongs_to :user
  belongs_to :shift_assignment
  has_many   :timesheet_disputes
end

# app/models/timesheet_dispute.rb
class TimesheetDispute < ApplicationRecord
  belongs_to :timesheet_line
  belongs_to :raised_by, class_name: "User"
  belongs_to :resolved_by, class_name: "User", optional: true
end

# app/models/conversation.rb
class Conversation < ApplicationRecord
  belongs_to :created_by, class_name: "User", optional: true
  has_many   :conversation_participants, dependent: :destroy
  has_many   :users, through: :conversation_participants
  has_many   :messages, dependent: :destroy
  has_one    :last_message, -> { order(created_at: :desc) }, class_name: "Message"
  enum :kind, { direct: 0, group: 1 }
  def self.direct_key_for(a, b) = [a, b].sort.join(":")
end

# app/models/conversation_participant.rb
class ConversationParticipant < ApplicationRecord
  belongs_to :conversation
  belongs_to :user
  scope :active, -> { where(left_at: nil) }
  def unread_count
    conversation.messages.where("id > ?", last_read_message_id || 0)
                .where.not(sender_id: user_id).count
  end
end

# app/models/message.rb
class Message < ApplicationRecord
  belongs_to :conversation, touch: :last_message_at
  belongs_to :sender, class_name: "User", foreign_key: :sender_id
  has_many   :message_attachments, dependent: :destroy
  has_many   :message_receipts, dependent: :destroy
  scope :visible, -> { where(deleted_at: nil) }
end

# app/models/message_attachment.rb
class MessageAttachment < ApplicationRecord
  belongs_to :message
end

# app/models/message_receipt.rb
class MessageReceipt < ApplicationRecord
  belongs_to :message
  belongs_to :user
end

# app/models/notification.rb
class Notification < ApplicationRecord
  belongs_to :user
  belongs_to :alert, optional: true
  belongs_to :subject, polymorphic: true, optional: true
end

# app/models/notification_preference.rb
class NotificationPreference < ApplicationRecord
  belongs_to :user
end
```

---

## 8. Project structure — Phase 1 only

```
bestpinnacle/
├── backend/                          # Rails 8 API-only
│   ├── app/
│   │   ├── models/                   # all §7 models + concerns/
│   │   ├── controllers/
│   │   │   ├── application_controller.rb
│   │   │   ├── concerns/
│   │   │   │   ├── authentication.rb          # JWT verify, Current.user
│   │   │   │   ├── authorisation.rb           # Pundit
│   │   │   │   ├── idempotency.rb             # client_event_id replay
│   │   │   │   └── error_handling.rb
│   │   │   └── api/v1/
│   │   │       ├── base_controller.rb
│   │   │       ├── sessions_controller.rb     # shared: refresh, logout
│   │   │       ├── me_controller.rb
│   │   │       ├── health_controller.rb
│   │   │       ├── admin/
│   │   │       │   ├── base_controller.rb     # authorises office roles
│   │   │       │   ├── auth_controller.rb     # POST login — rejects carers (403)
│   │   │       │   ├── rota_controller.rb
│   │   │       │   ├── shift_templates_controller.rb
│   │   │       │   ├── shifts_controller.rb
│   │   │       │   ├── shift_publications_controller.rb
│   │   │       │   ├── shift_assignments_controller.rb
│   │   │       │   ├── rota_copies_controller.rb
│   │   │       │   ├── live_board_controller.rb
│   │   │       │   ├── exceptions_controller.rb
│   │   │       │   ├── clock_corrections_controller.rb
│   │   │       │   ├── alerts_controller.rb
│   │   │       │   ├── timesheet_periods_controller.rb
│   │   │       │   ├── timesheet_lines_controller.rb
│   │   │       │   ├── timesheet_exports_controller.rb
│   │   │       │   ├── timesheet_disputes_controller.rb
│   │   │       │   ├── users_controller.rb
│   │   │       │   ├── locations_controller.rb
│   │   │       │   └── settings_controller.rb
│   │   │       ├── staff/
│   │   │       │   ├── base_controller.rb     # scopes to Current.user
│   │   │       │   ├── auth_controller.rb     # POST login — rejects office roles (403)
│   │   │       │   ├── shifts_controller.rb
│   │   │       │   ├── clock_controller.rb
│   │   │       │   ├── timesheet_controller.rb
│   │   │       │   ├── disputes_controller.rb
│   │   │       │   └── sync_controller.rb
│   │   │       └── shared/
│   │   │           ├── conversations_controller.rb
│   │   │           ├── messages_controller.rb
│   │   │           ├── message_receipts_controller.rb
│   │   │           ├── notifications_controller.rb
│   │   │           └── notification_preferences_controller.rb
│   │   ├── services/
│   │   │   ├── application_service.rb         # .call → Result
│   │   │   ├── result.rb
│   │   │   ├── events/record.rb               # THE only writer to events
│   │   │   ├── authentication/
│   │   │   │   ├── authenticate.rb            # (email, password, audience:) — 403 on role mismatch
│   │   │   │   ├── issue_tokens.rb
│   │   │   │   ├── rotate_refresh_token.rb
│   │   │   │   ├── revoke_device.rb
│   │   │   │   ├── invite_user.rb
│   │   │   │   ├── accept_invitation.rb
│   │   │   │   └── mfa/{enrol,verify}.rb
│   │   │   ├── settings/{read,update}.rb
│   │   │   ├── shifts/
│   │   │   │   ├── generate_from_templates.rb # nightly, idempotent
│   │   │   │   ├── create_ad_hoc.rb
│   │   │   │   ├── update_shift.rb
│   │   │   │   ├── cancel_shift.rb
│   │   │   │   ├── publish_rota.rb
│   │   │   │   ├── copy_week.rb
│   │   │   │   ├── assign_staff.rb
│   │   │   │   ├── unassign_staff.rb
│   │   │   │   ├── coverage_summary.rb
│   │   │   │   └── validators/
│   │   │   │       ├── base_validator.rb
│   │   │   │       ├── overlap_validator.rb
│   │   │   │       ├── rest_period_validator.rb     # WTD 11h
│   │   │   │       ├── weekly_hours_validator.rb    # WTD 48h
│   │   │   │       └── availability_validator.rb
│   │   │   ├── clocking/
│   │   │   │   ├── record_clock_event.rb      # idempotent core endpoint
│   │   │   │   ├── evaluate_geofence.rb       # server-side pass/fail/no_fix
│   │   │   │   ├── detect_time_anomaly.rb
│   │   │   │   ├── apply_correction.rb        # manager correction, reason required
│   │   │   │   ├── resolve_effective_times.rb
│   │   │   │   └── recalculate_assignment.rb
│   │   │   ├── lifecycle/
│   │   │   │   ├── state_machine.rb
│   │   │   │   ├── evaluate_assignment.rb
│   │   │   │   ├── evaluate_all.rb
│   │   │   │   └── auto_close_overdue.rb
│   │   │   ├── alerts/
│   │   │   │   ├── raise.rb
│   │   │   │   ├── suppress.rb
│   │   │   │   ├── acknowledge.rb
│   │   │   │   ├── resolve.rb
│   │   │   │   └── scanners/{missed_shift,late_start,no_clock_out}_scanner.rb
│   │   │   ├── notifications/
│   │   │   │   ├── deliver.rb
│   │   │   │   ├── resolve_recipients.rb
│   │   │   │   └── channels/{in_app,push,email}_channel.rb
│   │   │   ├── messaging/
│   │   │   │   ├── create_conversation.rb     # 1-to-1 dedupes on direct_key
│   │   │   │   ├── add_participants.rb
│   │   │   │   ├── send_message.rb            # idempotent on client_message_id
│   │   │   │   ├── mark_read.rb
│   │   │   │   └── unread_counts.rb
│   │   │   ├── timesheets/
│   │   │   │   ├── build_period.rb
│   │   │   │   ├── recalculate_line.rb
│   │   │   │   ├── approve_period.rb
│   │   │   │   ├── lock_period.rb
│   │   │   │   ├── raise_dispute.rb
│   │   │   │   └── exporters/{csv,xlsx}_exporter.rb
│   │   │   └── sync/{ingest_batch,build_changeset,cursor}.rb
│   │   ├── jobs/
│   │   │   ├── application_job.rb
│   │   │   ├── shifts/generate_upcoming_job.rb        # nightly
│   │   │   ├── lifecycle/evaluate_states_job.rb       # every 1 minute
│   │   │   ├── alerts/scan_shifts_job.rb              # every 1 minute
│   │   │   ├── notifications/{deliver_job,retry_failed_job}.rb
│   │   │   ├── messaging/notify_unread_job.rb
│   │   │   └── timesheets/{recalculate_job,open_next_period_job}.rb
│   │   ├── channels/
│   │   │   ├── application_cable/{connection,channel}.rb
│   │   │   ├── live_board_channel.rb
│   │   │   ├── conversation_channel.rb
│   │   │   ├── presence_channel.rb
│   │   │   └── notifications_channel.rb
│   │   ├── mailers/
│   │   │   ├── application_mailer.rb
│   │   │   ├── user_mailer.rb                 # invite, reset, MFA
│   │   │   ├── rota_mailer.rb                 # rota published, shift changed
│   │   │   ├── alert_mailer.rb
│   │   │   ├── timesheet_mailer.rb
│   │   │   └── message_mailer.rb              # unread chat digest
│   │   ├── serializers/
│   │   │   ├── application_serializer.rb
│   │   │   ├── {setting,user,shift,shift_assignment,clock_event}_serializer.rb
│   │   │   ├── {alert,timesheet_line}_serializer.rb
│   │   │   └── {conversation,message,notification}_serializer.rb
│   │   ├── policies/
│   │   │   ├── application_policy.rb
│   │   │   ├── {shift,shift_assignment,clock_event}_policy.rb
│   │   │   ├── timesheet_period_policy.rb
│   │   │   ├── {conversation,message}_policy.rb
│   │   │   └── setting_policy.rb
│   │   ├── queries/
│   │   │   ├── {rota_week,live_board,exceptions}_query.rb
│   │   │   ├── coverage_gaps_query.rb
│   │   │   ├── timesheet_summary_query.rb
│   │   │   └── inbox_query.rb
│   │   └── lib_support/
│   │       ├── recurrence/rrule_expander.rb
│   │       ├── time/working_time.rb          # DST-safe, overnight shifts
│   │       └── geo/haversine.rb
│   ├── config/
│   │   ├── application.rb                     # config.api_only = true
│   │   ├── routes.rb
│   │   ├── database.yml   cable.yml   queue.yml
│   │   ├── recurring.yml                      # SolidQueue cron
│   │   ├── deploy.yml                         # Kamal → Virtualmin
│   │   └── initializers/{current_attributes,jwt,cors,rack_attack,web_push,pundit}.rb
│   ├── db/
│   │   ├── migrate/                           # 001..011 (see §6 ordering)
│   │   ├── schema.rb
│   │   └── seeds/{settings,roles}.rb
│   ├── spec/
│   │   ├── services/
│   │   │   ├── clocking/{record_clock_event,apply_correction,detect_time_anomaly,evaluate_geofence}_spec.rb
│   │   │   ├── lifecycle/state_machine_spec.rb
│   │   │   ├── shifts/generate_from_templates_spec.rb
│   │   │   ├── messaging/send_message_spec.rb
│   │   │   ├── timesheets/dst_boundary_spec.rb
│   │   │   └── alerts/suppression_spec.rb
│   │   ├── requests/api/v1/
│   │   └── support/{auth_helpers,time_helpers,factories}/
│   ├── Dockerfile
│   └── Gemfile
│
└── frontend/                         # React 19 + TS + Vite
    ├── src/
    │   ├── main.tsx   App.tsx
    │   ├── routes/
    │   │   ├── index.tsx   ProtectedRoute.tsx
    │   │   ├── auth/
    │   │   │   ├── AdminLoginPage.tsx         # office login (desktop)
    │   │   │   ├── CarerLoginPage.tsx         # carer login (mobile/PWA)
    │   │   │   ├── AcceptInvitePage.tsx
    │   │   │   ├── ForgotPasswordPage.tsx
    │   │   │   └── MfaPage.tsx                # admin roles only
    │   │   ├── admin/
    │   │   │   ├── DashboardPage.tsx
    │   │   │   ├── RotaPage.tsx
    │   │   │   ├── ShiftTemplatesPage.tsx
    │   │   │   ├── LiveBoardPage.tsx
    │   │   │   ├── ExceptionsPage.tsx
    │   │   │   ├── TimesheetsPage.tsx
    │   │   │   ├── MessagesPage.tsx
    │   │   │   ├── StaffPage.tsx
    │   │   │   └── SettingsPage.tsx
    │   │   └── staff/
    │   │       ├── MyShiftsPage.tsx
    │   │       ├── ShiftDetailPage.tsx        # clock in/out
    │   │       ├── MyTimesheetPage.tsx
    │   │       └── MessagesPage.tsx
    │   ├── features/
    │   │   ├── auth/
    │   │   ├── rota/components/{WeekGrid,ShiftCell,AssignDrawer,ValidationWarnings,CoverageBar,PublishBanner,CopyWeekDialog}.tsx
    │   │   ├── clocking/{components/{ClockButton,GeoStatus,OfflineBadge},useClock.ts,api.ts}
    │   │   ├── liveBoard/{components/{StaffRow,StatusPill,CountsHeader},useLiveBoard.ts}
    │   │   ├── exceptions/components/{ExceptionList,CorrectionDialog}.tsx
    │   │   ├── timesheets/components/{PeriodTable,LineDrilldown,ExportMenu,DisputeDialog}.tsx
    │   │   ├── messaging/{components/{ConversationList,MessageThread,MessageComposer,NewConversationDialog,UnreadBadge},useConversation.ts,useUnreadCount.ts,api.ts}
    │   │   ├── notifications/{components/{NotificationBell,NotificationList},usePushSubscription.ts,useNotifications.ts}
    │   │   └── settings/
    │   ├── offline/{db,outbox,sync,useOnlineStatus,cacheStrategy,serviceWorker}.ts
    │   ├── lib/{apiClient,auth,queryClient,cable,geo,time,permissions,settings,format}.ts
    │   ├── types/{api,models,enums}.ts
    │   ├── components/{ui,layout/{ManageLayout,StaffLayout,AuthLayout},feedback}.tsx
    │   └── styles/index.css
    ├── public/{manifest.webmanifest,icons/}
    ├── vite.config.ts   tsconfig.json   tailwind.config.ts   package.json
    └── tests/e2e/{rota,clock-in-out,offline-queue,messaging}.spec.ts
```

---

## 9. Key API endpoints — Phase 1

```
POST   /api/v1/admin/auth/login           → { access, refresh, user }
       # Office login. Rejects role = carer with 403.
POST   /api/v1/staff/auth/login           → { access, refresh, user }
       # Carer login. Rejects office roles with 403.
POST   /api/v1/auth/refresh
DELETE /api/v1/auth/logout
GET    /api/v1/me

# Office (manager+)
GET    /api/v1/admin/rota?from=&to=
POST   /api/v1/admin/shift_templates
POST   /api/v1/admin/shifts
POST   /api/v1/admin/shifts/:id/publish        # publish_rota
POST   /api/v1/admin/rota_copies               # copy_week
POST   /api/v1/admin/shift_assignments         # returns validation warnings
DELETE /api/v1/admin/shift_assignments/:id
GET    /api/v1/admin/live_board
GET    /api/v1/admin/exceptions
POST   /api/v1/admin/clock_corrections         # manual_admin, reason required
POST   /api/v1/admin/alerts/:id/acknowledge
GET    /api/v1/admin/timesheet_periods/:id
POST   /api/v1/admin/timesheet_periods/:id/approve
GET    /api/v1/admin/timesheet_exports/:id     # CSV/XLSX
POST   /api/v1/admin/users                     # invite staff
GET    /api/v1/admin/settings
PATCH  /api/v1/admin/settings

# Carer (PWA)
GET    /api/v1/staff/shifts?from=&to=
POST   /api/v1/staff/shift_assignments/:id/clock
       { kind, client_event_id, occurred_at, lat, lng, accuracy_m, device_fingerprint }
       → 201 { server_time, lifecycle_state, geofence: pass|fail|no_fix }
       → 200 identical body on replay of same client_event_id
       → 422 { error: "too_far", distance_m } when geofence blocks
GET    /api/v1/staff/timesheet?period=
POST   /api/v1/staff/disputes
POST   /api/v1/staff/sync/events                # batch outbound
GET    /api/v1/staff/sync/changes?since=cursor  # pull

# Shared (chat + notifications)
GET    /api/v1/conversations
POST   /api/v1/conversations                    # 1-to-1 dedupes on direct_key
GET    /api/v1/conversations/:id/messages?before=
POST   /api/v1/conversations/:id/messages       { body, client_message_id }
POST   /api/v1/messages/:id/receipts            # mark read
GET    /api/v1/notifications
POST   /api/v1/notifications/:id/seen
GET    /api/v1/notification_preferences
PATCH  /api/v1/notification_preferences
```

---

## 10. Build order (week 1)

| Day | Deliver |
|-----|---------|
| 1 | Rails API skeleton, CI, Kamal to UK host; settings, users, devices, auth (JWT+MFA), events table + `Events::Record` |
| 2 | Locations; shift_templates; `Shifts::GenerateFromTemplates`; publish flow |
| 3 | Assignments + validators; rota controller/queries; React rota grid + publish |
| 4 | Clock endpoint (idempotency, geofence block/no_fix, skew); staff PWA clock in/out + offline outbox |
| 5 | Lifecycle FSM + 1-min evaluator; alert scanners; live board (cable); exceptions + corrections; chat (conversations/messages/receipts) both apps |
| 6 | Timesheets: build/recalculate/approve/lock + CSV/XLSX export; disputes; notifications + push |
| 7 | Test pass (idempotent replay, correction chains, DST, FSM transitions); UAT on real phones; go-live |

## 11. Tests that must pass

1. **Idempotent replay** — same `client_event_id` twice → one clock event, identical response.
2. **Correction chain** — original → correction → correction-of-correction resolves to the last; superseded rows still visible; `effective_clock_events` correct.
3. **DST** — a 23:00–07:00 shift is 7h on the March transition, 9h in October; `worked_minutes` reflects reality; hours attributed to the shift's start date.
4. **FSM** — every transition in §5, including grace-expiry → missed and auto-close.
5. **Geofence** — pass within radius; fail (blocked, no event) outside; no_fix allowed + alerted.
6. **Clock skew** — device 30 min fast → `time_anomaly` flag, routed to pending_review, not rejected.
7. **Offline** — queue 3 events offline, reconnect, all land in order with correct `occurred_at`.
8. **Chat** — 1-to-1 create is idempotent on `direct_key` (no duplicate thread for same pair); message send idempotent on `client_message_id`; unread count correct.

## 12. Things deliberately NOT in Phase 1

service_users, visits/EVV, care plans, assessments, eMAR, carers/HR, invoicing, pay/NMW, incidents, audits, reports, daycare, navigation/maps, family portal, AI note composition. All arrive in Phase 2 (weeks 2–4) and attach to this foundation without reshaping it.
```