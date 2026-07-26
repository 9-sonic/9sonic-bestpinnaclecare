# Best Pinnacle Care — Phase 1 Build Context

> Single-file context for an LLM to build **Phase 1 only** (week 1).
> Scope: foundation + service-user visits, care-package rotas, geofenced clock in/out, attendance, staff chat, notifications.
> Out of scope for Phase 1: eMAR, HR detail, finance/pay, care planning. (Service users & visits ARE Phase 1 now — see §1a, which supersedes the location-based shift model in §5–§9.)

---

## 1. What this is

A care-management app for **Best Pinnacle Care**, a UK domiciliary (home-care) provider. Phase 1 delivers staff **shift scheduling and clock in/out** — the office builds a rota, carers see it on their phones, clock in/out with GPS + time captured, and hours flow into approvable timesheets. Staff chat and notifications ship alongside.

**Deployment:** single-tenant. One instance for Best Pinnacle on their own server (Virtualmin), own database, own resources. **No `organisation_id`, no multi-tenancy, no row-level security.** One install = one provider. All provider configuration lives in a single-row `settings` table, editable in-app.

## 1a. Phase 1 revision — service-user visits & offline PWA (supersedes the location-based shift model in §5–§9)

Phase 1 is **visit-based domiciliary care (EVV)**, not shift work at fixed sites. A carer travels to a **service user's home** and clocks in/out **at the home**, from a **PWA on their own phone**, verified by a geofence around that home. Service users and visits are therefore **core Phase 1** (they were wrongly deferred to Phase 2 in §14).

### Core entities (rename map from §8–§9)
| Old | New | Note |
|---|---|---|
| `Location` | **retired** | the geofence anchor is the service user's home, not a fixed site |
| — | **`ServiceUser`** | the patient/client; home address is the geofence centre; **not a login** |
| `ShiftTemplate` | **`CarePackageSlot`** | recurring contracted call, attached to a service user |
| `Shift` | **`Visit`** | one dated call to one service user (`service_user_id`; no `location_id`) |
| `ShiftAssignment` | **`VisitAssignment`** | the carer doing the visit; keeps the lifecycle FSM + worked minutes |
| `Timesheet*` | **attendance** | `worked_minutes = clock_out − clock_in`; **no pay anywhere** |

**`ServiceUser`**: name, reference, DOB?, phone, address; `lat`/`lng` (geocoded home = geofence centre); `geofence_radius_m` (default 150) + optional `geofence_mode`; access / key-safe notes; `active`. Not an auth identity (no login in Phase 1).

**Spine**: `ServiceUser → CarePackageSlot (contracted times) → generated Visits → manually-assigned carer → geofenced clock-in/out per visit → attendance record`.

**Carer turnover is high**, so: never delete a carer (soft-deactivate — history is immutable, CQC); reassignment on a leaver is **manual, per visit** (the visit stays, the assignment moves); durable data lives on the service user, never on the carer.

### Geofence (revised — anchor is `service_user.home`)
`block` mode, 150 m default. Within 150 m → `pass`; outside with a fix → blocked; no fix → allowed + `geo_anomaly`; stuck outside → `manual_admin` correction. **Server owns the result; the phone's result is never trusted.**

### Offline-first clocking (carers sit in poor-signal homes for LONG stretches)
Clock-in must work with **no connectivity, for extended periods (hours)**. Two tiers:

1. **On device (provisional):** the carer's upcoming visits + each service user's home coords/radius/access notes are **synced down and cached** (IndexedDB). At tap time the PWA does a *local* geofence check for instant feedback and writes the event to an **outbox** with `client_event_id`, `occurred_at` (device tap time), lat/lng, accuracy — **no network or valid token needed to capture**.
2. **On server (authoritative):** on reconnect the outbox syncs; the server **re-computes** geofence + skew from the submitted coords, sets the real `geofence_result`, advances the lifecycle, records `recorded_at`. Idempotent on `client_event_id` (unique) so replays can't double-record. Append-only — nothing captured in the field is dropped.

**Long-offline logic (best-effort for hours-long outages):**
- Capture never depends on a live session; **sync** re-authenticates in one biometric/passkey tap. Because carers may be offline for hours, the **staff access token gets a longer TTL and/or a device-bound refresh** so a day in the field doesn't churn logins — revisit the "full devise-jwt / no refresh" choice for the *staff* scope specifically.
- An out-of-range clock-in captured offline (couldn't be blocked in real time) is **recorded, flagged `fail`, routed to `pending_review`** — never silently discarded (we can't un-capture a real event; we never lose a care record).
- Sync is **cursor-based + resumable** (`GET /staff/sync/changes?since=`) and **batched** (`POST /staff/sync/events`) so a large backlog after a long outage lands in order without timing out; conflicts resolve by `occurred_at`.
- Service worker caches the app shell; Web Push (VAPID) delivers notifications when the app is closed (subscription stored on `devices`).

## 2. Two identities: Admin and Employee

The system has **two separate kinds of person, in two separate tables, with two separate logins:**

- **Admin** — the office. Roles: `registered_manager`, `manager`, `coordinator`, `finance`, `auditor`. Log in at the admin endpoint (desktop). Build rotas, assign staff, approve timesheets, handle exceptions, correct clock times.
- **Employee** — the carers. Roles: `carer`, `senior_carer`. Log in at the carer endpoint (mobile PWA). Work shifts, clock in/out, chat, see their timesheet.

They never share a table. Where a record could be created or owned by **either** an Admin or an Employee (chat, notifications, devices, the audit actor, a clock event's creator), the reference is **polymorphic** (`*_type` + `*_id`). Where only one kind applies, the FK is direct (`shift_assignments.employee_id`, `timesheet_periods.approved_by_admin_id`).

## 3. Stack

- **Backend:** Rails 8, **API-only**. Ruby 3.4, PostgreSQL 17.
- **Frontend:** React 19 + TypeScript, Vite, one SPA — `/admin` (office) and `/staff` (carer PWA) routes. TanStack Query, React Router, Tailwind, Dexie for the offline outbox.
- **Jobs/cache/cable:** SolidQueue, SolidCache, SolidCable (Postgres-backed).
- **Auth:** JWT (15-min access + rotating refresh bound to device). MFA required for admins; optional for employees. **Separate login endpoints** — `POST /api/v1/admin/auth/login` authenticates against `admins`; `POST /api/v1/staff/auth/login` authenticates against `employees`. Each rejects the wrong table's credentials. Refresh and logout are shared.
- **Deploy:** Kamal 2 to the UK Virtualmin host. Timezone `Europe/London`.

## 4. Non-negotiable behavioural rules

1. **Append-only audit.** `clock_events` and `events` never update or delete (Postgres RULEs + REVOKE). A manager correcting a clock time inserts a **new** `clock_event` with `corrects_id` → the original and a mandatory `reason`. Original stays visible forever. `effective_clock_events` view resolves the chain.
2. **One writer to `events`.** `Events::Record.call` is the only insert path, inside the same transaction as the change. `actor` is polymorphic (Admin | Employee | System).
3. **Idempotency.** Every employee-originated mutation carries a client-generated UUID (`client_event_id` / `client_message_id`), unique-constrained. A retry can't double-record. Applies to clock events and chat messages.
4. **Device time is honest.** `occurred_at` = tap time (device clock). `recorded_at` = server receipt. Device clock off by more than `clock_skew_tolerance_minutes` is flagged `time_anomaly` and routed to review, never silently dropped.
5. **Server owns the truth.** Geofence result, lifecycle state, worked-minutes computed server-side. Client's geofence result is never trusted.
6. **Clocking must not go down at 06:45.** Zero-downtime deploys; offline outbox absorbs brief outages.

## 5. Geofence rule (clock-in) — anchor is the service user's home; offline-aware (see §1a)

Provider default `geofence_mode = 'block'`, `geofence_radius_m = 150`:

- **Within 150 m, GPS fix** → succeeds, `geofence_result = 'pass'`.
- **Outside 150 m, GPS fix** → **blocked**, `geofence_result = 'fail'`, no clock event written. UI: "You're too far from the location to start."
- **No GPS fix** → **allowed**, `geofence_result = 'no_fix'`, raises a `geo_anomaly` alert to the exceptions queue. Care recording is never blocked by a dead GPS chip.
- **Stuck outside** → an admin authorises remotely via a `manual_admin` clock event with reason (the correction path).

## 6. Shift lifecycle state machine

Timer-driven FSM on `shift_assignments.lifecycle_state`, advanced by a **1-minute** SolidQueue job (`Lifecycle::EvaluateStatesJob`). Thresholds from `settings`.

```
scheduled
   │ T − checkin_window_before_start_minutes (default 15)
   ▼
check_in_window ──valid clock_in──────────────────────────► in_progress
   │                                                            │
   │ scheduled_start passed, no clock_in                        │ valid clock_out
   ▼                                                            ▼
grace_period ──clock_in within grace──► late ──clock_out──► completed
   │ grace expired (missed_threshold_minutes, default 30), no clock_in
   ▼
missed

in_progress ──scheduled_end + overdue_threshold (default 60)──► overdue
overdue ──valid clock_out──► completed (flagged)
overdue / grace_period ──anomaly (geo/time/no clock_out)──► pending_review
pending_review ──admin confirms valid──► completed
pending_review ──admin confirms failed──► missed
in_progress ──scheduled_end + auto_close_after (default 240)──► auto clock-out, flag 'auto_closed', blocks timesheet approval until an admin confirms
any ──authorised cancel──► cancelled
```

Alert suppression is required: don't re-raise an alert already open for the same subject+type; respect the cooldown.

## 7. Notifications — how people get told

**Alert** = an operational condition an admin must act on (a carer is late/missed). Lives in `alerts`, has an acknowledge/resolve lifecycle. **Notification** = one delivery of a heads-up to one person on one channel. Lives in `notifications`. An alert fans out into notifications; a chat message produces a notification with **no** alert.

Recipients are polymorphic — a notification goes to an Admin or an Employee.

**Channels:** `in_app` (WebSocket broadcast, live bell), `push` (Web Push/VAPID, lock screen when app closed), `email` (ActionMailer, for waitable items + critical fallback).

| Trigger | Recipients | Channels | Raises alert? |
|---|---|---|---|
| Rota published | employees on the rota | push + in_app | no |
| Shift changed / cancelled | that employee | push + in_app | no |
| Shift assigned | that employee | in_app (push if <24h) | no |
| **Missed shift** | on-duty admins | in_app + push | **yes** |
| **Late clock-in** | admins | in_app | **yes** |
| **No clock-out** overdue | admins | in_app + push | **yes** |
| **Geofence block / no-fix** | admins | in_app (exceptions) | **yes** |
| Clock correction by admin | affected employee | in_app | no |
| Timesheet ready to approve | admins (manager) | in_app + email | no |
| Timesheet dispute raised | admins | in_app | no |
| **New chat message** | thread participants | in_app instantly; push if unread after 2 min | no |

Pipeline: condition → `Alerts::Raise` (shift/clock) or straight to `Notifications::Deliver` (chat) → `ResolveRecipients` → check each recipient's `NotificationPreference` per channel → write one `notifications` row per enabled channel → channel sends. Idempotent per (source, recipient, channel). Critical in-app alerts (missed, no-clock-out) ignore the preference off-switch. Failed push/email retried, then email fallback for critical alerts.

---

## 8. Schema — Phase 1 (PostgreSQL 17)

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

-- ---- Admins (office) ------------------------------------------------
CREATE TYPE admin_role AS ENUM
    ('registered_manager','manager','coordinator','finance','auditor');

CREATE TABLE admins (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email               citext NOT NULL UNIQUE,
    password_digest     text NOT NULL,
    first_name          text NOT NULL,
    last_name           text NOT NULL,
    phone               text,
    role                admin_role NOT NULL,
    mfa_secret          text,
    mfa_enabled         boolean NOT NULL DEFAULT true,   -- required for admins
    failed_attempts     integer NOT NULL DEFAULT 0,
    locked_at           timestamptz,
    invited_at          timestamptz,
    accepted_invite_at  timestamptz,
    last_sign_in_at     timestamptz,
    active              boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_admins_active ON admins(active) WHERE active;

-- ---- Employees (carers) ---------------------------------------------
CREATE TYPE employee_role AS ENUM ('carer','senior_carer');

CREATE TABLE employees (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email               citext NOT NULL UNIQUE,
    password_digest     text,
    first_name          text NOT NULL,
    last_name           text NOT NULL,
    phone               text,
    role                employee_role NOT NULL DEFAULT 'carer',
    employee_reference  text,
    mfa_secret          text,
    mfa_enabled         boolean NOT NULL DEFAULT false,  -- optional for employees
    failed_attempts     integer NOT NULL DEFAULT 0,
    locked_at           timestamptz,
    invited_at          timestamptz,
    accepted_invite_at  timestamptz,
    last_sign_in_at     timestamptz,
    active              boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_employees_active ON employees(active) WHERE active;

-- ---- Devices & refresh tokens (owned by an Admin OR an Employee) ----
CREATE TABLE devices (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_type          text NOT NULL,        -- 'Admin' | 'Employee'
    owner_id            bigint NOT NULL,
    fingerprint         uuid NOT NULL UNIQUE,
    platform            text,
    app_version         text,
    push_subscription   jsonb,
    last_seen_at        timestamptz,
    revoked_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_devices_owner ON devices(owner_type, owner_id);

CREATE TABLE refresh_tokens (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_type          text NOT NULL,        -- 'Admin' | 'Employee'
    owner_id            bigint NOT NULL,
    device_id           bigint REFERENCES devices(id),
    token_digest        text NOT NULL,
    expires_at          timestamptz NOT NULL,
    revoked_at          timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_owner ON refresh_tokens(owner_type, owner_id);

-- ---- Event log (append-only) ---------------------------------------
CREATE TABLE events (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_type          text NOT NULL,
    aggregate_type      text NOT NULL,
    aggregate_id        bigint NOT NULL,
    actor_type          text NOT NULL,        -- 'Admin' | 'Employee' | 'System'
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
    geofence_radius_m   integer,
    geofence_mode       text,
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
    end_time            time NOT NULL,
    recurrence          text NOT NULL,
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
    shift_template_id   bigint REFERENCES shift_templates(id),
    location_id         bigint REFERENCES locations(id),
    scheduled_start     timestamptz NOT NULL,
    scheduled_end       timestamptz NOT NULL,
    break_minutes       integer NOT NULL DEFAULT 0,
    staff_required      integer NOT NULL DEFAULT 1,
    status              shift_status NOT NULL DEFAULT 'draft',
    published_at        timestamptz,
    published_by_admin_id bigint REFERENCES admins(id),
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
    employee_id         bigint NOT NULL REFERENCES employees(id),
    role                text NOT NULL DEFAULT 'worker',   -- worker|supervisor|shadow
    assignment_status   text NOT NULL DEFAULT 'assigned', -- assigned|withdrawn
    lifecycle_state     lifecycle_state NOT NULL DEFAULT 'scheduled',
    actual_start        timestamptz,
    actual_end          timestamptz,
    worked_minutes      integer,
    flags               text[] NOT NULL DEFAULT '{}',
    override_reason     text,
    assigned_by_admin_id bigint REFERENCES admins(id),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_assignments_unique
    ON shift_assignments(shift_id, employee_id) WHERE assignment_status = 'assigned';
CREATE INDEX idx_assignments_employee ON shift_assignments(employee_id, lifecycle_state);
CREATE INDEX idx_assignments_state ON shift_assignments(lifecycle_state);

-- ---- Clock events (append-only; creator is Admin or Employee) --------
CREATE TYPE clock_kind AS ENUM ('clock_in','clock_out');
CREATE TYPE geofence_result AS ENUM ('pass','fail','no_fix','not_checked');

CREATE TABLE clock_events (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    shift_assignment_id   bigint NOT NULL REFERENCES shift_assignments(id),
    kind                  clock_kind NOT NULL,
    occurred_at           timestamptz NOT NULL,
    recorded_at           timestamptz NOT NULL DEFAULT now(),
    method                text NOT NULL DEFAULT 'gps',   -- gps|manual_admin
    lat numeric(10,7), lng numeric(10,7), accuracy_m integer,
    geofence_result       geofence_result NOT NULL DEFAULT 'not_checked',
    distance_from_site_m  integer,
    device_fingerprint    uuid,
    client_event_id       uuid NOT NULL UNIQUE,
    reason                text,                 -- required if manual_admin
    corrects_id           bigint REFERENCES clock_events(id),
    created_by_type       text,                 -- 'Admin' | 'Employee' (polymorphic creator)
    created_by_id         bigint,
    CHECK (method <> 'manual_admin' OR reason IS NOT NULL)
);
CREATE INDEX idx_clock_events_assignment ON clock_events(shift_assignment_id, occurred_at);
CREATE INDEX idx_clock_events_corrects ON clock_events(corrects_id);
CREATE RULE clock_events_no_update AS ON UPDATE TO clock_events DO INSTEAD NOTHING;
CREATE RULE clock_events_no_delete AS ON DELETE TO clock_events DO INSTEAD NOTHING;

CREATE VIEW effective_clock_events AS
SELECT ce.* FROM clock_events ce
WHERE NOT EXISTS (SELECT 1 FROM clock_events c2 WHERE c2.corrects_id = ce.id);

-- ---- Alerts (acknowledged only by admins) --------------------------
CREATE TYPE alert_state AS ENUM ('open','acknowledged','resolved');

CREATE TABLE alerts (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    alert_type          text NOT NULL,
    subject_type        text NOT NULL,
    subject_id          bigint NOT NULL,
    severity            text NOT NULL DEFAULT 'normal',
    raised_at           timestamptz NOT NULL DEFAULT now(),
    state               alert_state NOT NULL DEFAULT 'open',
    acknowledged_by_admin_id bigint REFERENCES admins(id),
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
    status              text NOT NULL DEFAULT 'open',   -- open|approved|locked
    approved_by_admin_id bigint REFERENCES admins(id),
    approved_at         timestamptz,
    locked_at           timestamptz,
    CHECK (ends_on >= starts_on)
);

CREATE TABLE timesheet_lines (
    id                    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timesheet_period_id   bigint NOT NULL REFERENCES timesheet_periods(id),
    employee_id           bigint NOT NULL REFERENCES employees(id),
    shift_assignment_id   bigint NOT NULL REFERENCES shift_assignments(id),
    work_date             date NOT NULL,        -- overnight ⇒ shift START date
    scheduled_minutes     integer NOT NULL,
    worked_minutes        integer NOT NULL,     -- exact; rounding at export
    break_minutes         integer NOT NULL DEFAULT 0,
    flags                 text[] NOT NULL DEFAULT '{}',
    UNIQUE (timesheet_period_id, shift_assignment_id)
);
CREATE INDEX idx_timesheet_lines_employee ON timesheet_lines(employee_id, work_date);

CREATE TABLE timesheet_disputes (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    timesheet_line_id   bigint NOT NULL REFERENCES timesheet_lines(id),
    raised_by_employee_id bigint NOT NULL REFERENCES employees(id),
    reason              text NOT NULL,
    state               text NOT NULL DEFAULT 'open',
    resolved_by_admin_id bigint REFERENCES admins(id),
    resolution_note     text,
    created_at          timestamptz NOT NULL DEFAULT now()
);

-- ---- Messaging (staff chat; participants are Admin OR Employee) ------
CREATE TYPE conversation_kind AS ENUM ('direct','group');

CREATE TABLE conversations (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kind                conversation_kind NOT NULL,
    title               text,
    direct_key          text UNIQUE,          -- sorted "Type:id" pair, dedupes 1-to-1
    created_by_type     text,                 -- 'Admin' | 'Employee'
    created_by_id       bigint,
    last_message_at     timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (kind <> 'direct' OR direct_key IS NOT NULL)
);
CREATE INDEX idx_conversations_recent ON conversations(last_message_at DESC NULLS LAST);

CREATE TABLE conversation_participants (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id     bigint NOT NULL REFERENCES conversations(id),
    participant_type    text NOT NULL,        -- 'Admin' | 'Employee'
    participant_id      bigint NOT NULL,
    role                text NOT NULL DEFAULT 'member',
    joined_at           timestamptz NOT NULL DEFAULT now(),
    left_at             timestamptz,
    muted               boolean NOT NULL DEFAULT false,
    last_read_message_id bigint,
    UNIQUE (conversation_id, participant_type, participant_id)
);
CREATE INDEX idx_participants_person
    ON conversation_participants(participant_type, participant_id) WHERE left_at IS NULL;

CREATE TABLE messages (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    conversation_id     bigint NOT NULL REFERENCES conversations(id),
    sender_type         text NOT NULL,        -- 'Admin' | 'Employee'
    sender_id           bigint NOT NULL,
    body                text,
    client_message_id   uuid NOT NULL UNIQUE,
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
    recipient_type      text NOT NULL,        -- 'Admin' | 'Employee'
    recipient_id        bigint NOT NULL,
    delivered_at        timestamptz,
    read_at             timestamptz,
    UNIQUE (message_id, recipient_type, recipient_id)
);
CREATE INDEX idx_receipts_unread
    ON message_receipts(recipient_type, recipient_id) WHERE read_at IS NULL;

-- ---- Notifications (recipient is Admin OR Employee) ----------------
CREATE TABLE notifications (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    recipient_type      text NOT NULL,        -- 'Admin' | 'Employee'
    recipient_id        bigint NOT NULL,
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
CREATE INDEX idx_notifications_recipient
    ON notifications(recipient_type, recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unseen
    ON notifications(recipient_type, recipient_id)
    WHERE seen_at IS NULL AND channel = 'in_app';

CREATE TABLE notification_preferences (
    id                  bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    owner_type          text NOT NULL,        -- 'Admin' | 'Employee'
    owner_id            bigint NOT NULL,
    notification_type   text NOT NULL,
    in_app              boolean NOT NULL DEFAULT true,
    push                boolean NOT NULL DEFAULT true,
    email               boolean NOT NULL DEFAULT false,
    UNIQUE (owner_type, owner_id, notification_type)
);

-- Seed: single settings row + first admin
-- INSERT INTO settings (id, company_name) VALUES (1, 'Best Pinnacle Care Ltd');
```

---

## 9. Models — Phase 1 (ActiveRecord)

```ruby
# app/models/concerns/append_only.rb
module AppendOnly
  extend ActiveSupport::Concern
  included do
    before_update  { raise ActiveRecord::ReadOnlyRecord, "#{self.class} is append-only" }
    before_destroy { raise ActiveRecord::ReadOnlyRecord, "#{self.class} is append-only" }
  end
end

# app/models/concerns/authenticatable.rb  — shared by Admin and Employee
module Authenticatable
  extend ActiveSupport::Concern
  included do
    has_secure_password validations: false
    has_many :devices,        as: :owner, dependent: :destroy
    has_many :refresh_tokens, as: :owner, dependent: :destroy
    has_many :notifications,  as: :recipient, dependent: :destroy
    has_many :notification_preferences, as: :owner, dependent: :destroy
    has_many :conversation_participants, as: :participant
    scope :active, -> { where(active: true) }
  end
  def full_name = "#{first_name} #{last_name}"
end

# app/models/setting.rb
class Setting < ApplicationRecord
  def self.instance = first_or_create!(id: 1)
  def geofence_for(location)
    { mode:   location&.geofence_mode   || geofence_mode,
      radius: location&.geofence_radius_m || geofence_radius_m }
  end
end

# app/models/admin.rb
class Admin < ApplicationRecord
  include Authenticatable
  enum :role, { registered_manager: 0, manager: 1, coordinator: 2, finance: 3, auditor: 4 }

  has_many :published_shifts, class_name: "Shift", foreign_key: :published_by_admin_id
  has_many :assigned_shift_assignments, class_name: "ShiftAssignment", foreign_key: :assigned_by_admin_id
  has_many :approved_periods, class_name: "TimesheetPeriod", foreign_key: :approved_by_admin_id
  has_many :acknowledged_alerts, class_name: "Alert", foreign_key: :acknowledged_by_admin_id
end

# app/models/employee.rb
class Employee < ApplicationRecord
  include Authenticatable
  enum :role, { carer: 0, senior_carer: 1 }

  has_many :shift_assignments, dependent: :restrict_with_error
  has_many :shifts, through: :shift_assignments
  has_many :timesheet_lines
  has_many :raised_disputes, class_name: "TimesheetDispute", foreign_key: :raised_by_employee_id
end

# app/models/device.rb
class Device < ApplicationRecord
  belongs_to :owner, polymorphic: true   # Admin | Employee
  has_many   :refresh_tokens
  scope :active, -> { where(revoked_at: nil) }
end

# app/models/refresh_token.rb
class RefreshToken < ApplicationRecord
  belongs_to :owner, polymorphic: true
  belongs_to :device, optional: true
  scope :active, -> { where(revoked_at: nil).where("expires_at > ?", Time.current) }
end

# app/models/event.rb
class Event < ApplicationRecord
  include AppendOnly
  belongs_to :aggregate, polymorphic: true
  belongs_to :actor, polymorphic: true, optional: true   # Admin | Employee | (System = nil)
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
end

# app/models/shift.rb
class Shift < ApplicationRecord
  belongs_to :shift_template, optional: true
  belongs_to :location, optional: true
  belongs_to :published_by, class_name: "Admin", foreign_key: :published_by_admin_id, optional: true
  has_many   :shift_assignments, dependent: :destroy
  has_many   :employees, through: :shift_assignments

  enum :status, { draft: 0, published: 1, cancelled: 2 }
  scope :published, -> { where(status: :published) }
  validates :scheduled_end, comparison: { greater_than: :scheduled_start }
end

# app/models/shift_assignment.rb
class ShiftAssignment < ApplicationRecord
  belongs_to :shift
  belongs_to :employee
  belongs_to :assigned_by, class_name: "Admin", foreign_key: :assigned_by_admin_id, optional: true
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
  belongs_to :created_by, polymorphic: true, optional: true   # Admin (correction) | Employee (own clock)
  belongs_to :corrects, class_name: "ClockEvent", optional: true
  has_one    :corrected_by, class_name: "ClockEvent", foreign_key: :corrects_id

  enum :kind, { clock_in: 0, clock_out: 1 }
  enum :geofence_result, { pass: 0, fail: 1, no_fix: 2, not_checked: 3 }, prefix: :geo
  scope :effective, -> { where.not(id: ClockEvent.where.not(corrects_id: nil).select(:corrects_id)) }
  validates :reason, presence: true, if: -> { method == "manual_admin" }
end

# app/models/alert.rb
class Alert < ApplicationRecord
  belongs_to :subject, polymorphic: true
  belongs_to :acknowledged_by, class_name: "Admin", foreign_key: :acknowledged_by_admin_id, optional: true
  has_many   :notifications
  enum :state, { open: 0, acknowledged: 1, resolved: 2 }
  scope :open_for, ->(s) { where(subject: s, state: :open) }
end

# app/models/timesheet_period.rb
class TimesheetPeriod < ApplicationRecord
  has_many   :timesheet_lines, dependent: :destroy
  belongs_to :approved_by, class_name: "Admin", foreign_key: :approved_by_admin_id, optional: true
  enum :status, { open: "open", approved: "approved", locked: "locked" }, default: "open"
end

# app/models/timesheet_line.rb
class TimesheetLine < ApplicationRecord
  belongs_to :timesheet_period
  belongs_to :employee
  belongs_to :shift_assignment
  has_many   :timesheet_disputes
end

# app/models/timesheet_dispute.rb
class TimesheetDispute < ApplicationRecord
  belongs_to :timesheet_line
  belongs_to :raised_by, class_name: "Employee", foreign_key: :raised_by_employee_id
  belongs_to :resolved_by, class_name: "Admin", foreign_key: :resolved_by_admin_id, optional: true
end

# app/models/conversation.rb
class Conversation < ApplicationRecord
  belongs_to :created_by, polymorphic: true, optional: true
  has_many   :conversation_participants, dependent: :destroy
  has_many   :messages, dependent: :destroy
  has_one    :last_message, -> { order(created_at: :desc) }, class_name: "Message"
  enum :kind, { direct: 0, group: 1 }
  # direct_key: sorted "Type:id" pair, e.g. "Admin:3:Employee:12" → one thread per pair
  def self.direct_key_for(a, b) = [ "#{a.class}:#{a.id}", "#{b.class}:#{b.id}" ].sort.join("|")
end

# app/models/conversation_participant.rb
class ConversationParticipant < ApplicationRecord
  belongs_to :conversation
  belongs_to :participant, polymorphic: true   # Admin | Employee
  scope :active, -> { where(left_at: nil) }
  def unread_count
    conversation.messages.where("id > ?", last_read_message_id || 0)
                .where.not(sender_type: participant_type, sender_id: participant_id).count
  end
end

# app/models/message.rb
class Message < ApplicationRecord
  belongs_to :conversation, touch: :last_message_at
  belongs_to :sender, polymorphic: true   # Admin | Employee
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
  belongs_to :recipient, polymorphic: true   # Admin | Employee
end

# app/models/notification.rb
class Notification < ApplicationRecord
  belongs_to :recipient, polymorphic: true   # Admin | Employee
  belongs_to :alert, optional: true
  belongs_to :subject, polymorphic: true, optional: true
end

# app/models/notification_preference.rb
class NotificationPreference < ApplicationRecord
  belongs_to :owner, polymorphic: true   # Admin | Employee
end
```

---

## 10. Project structure — Phase 1 only

```
bestpinnacle/
├── backend/                          # Rails 8 API-only
│   ├── app/
│   │   ├── models/                   # all §9 models + concerns/{append_only,authenticatable}.rb
│   │   ├── controllers/
│   │   │   ├── application_controller.rb
│   │   │   ├── concerns/{authentication,authorisation,idempotency,error_handling}.rb
│   │   │   └── api/v1/
│   │   │       ├── sessions_controller.rb     # shared: refresh, logout
│   │   │       ├── health_controller.rb
│   │   │       ├── admin/
│   │   │       │   ├── base_controller.rb      # authenticates Admin, checks role
│   │   │       │   ├── auth_controller.rb      # POST login → admins table only
│   │   │       │   ├── dashboard_controller.rb
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
│   │   │       │   ├── employees_controller.rb  # invite/manage carers
│   │   │       │   ├── admins_controller.rb     # invite/manage office users
│   │   │       │   ├── locations_controller.rb
│   │   │       │   └── settings_controller.rb
│   │   │       ├── staff/
│   │   │       │   ├── base_controller.rb       # authenticates Employee, scopes to self
│   │   │       │   ├── auth_controller.rb       # POST login → employees table only
│   │   │       │   ├── shifts_controller.rb
│   │   │       │   ├── clock_controller.rb
│   │   │       │   ├── timesheet_controller.rb
│   │   │       │   ├── disputes_controller.rb
│   │   │       │   └── sync_controller.rb
│   │   │       └── shared/                       # both audiences (polymorphic)
│   │   │           ├── conversations_controller.rb
│   │   │           ├── messages_controller.rb
│   │   │           ├── message_receipts_controller.rb
│   │   │           ├── notifications_controller.rb
│   │   │           └── notification_preferences_controller.rb
│   │   ├── services/
│   │   │   ├── application_service.rb   result.rb
│   │   │   ├── events/record.rb                  # only writer; actor = Admin|Employee|System
│   │   │   ├── authentication/
│   │   │   │   ├── authenticate.rb               # (email, password, scope: Admin|Employee)
│   │   │   │   ├── issue_tokens.rb   rotate_refresh_token.rb   revoke_device.rb
│   │   │   │   ├── invite_admin.rb   invite_employee.rb   accept_invitation.rb
│   │   │   │   └── mfa/{enrol,verify}.rb
│   │   │   ├── settings/{read,update}.rb
│   │   │   ├── shifts/
│   │   │   │   ├── generate_from_templates.rb  create_ad_hoc.rb  update_shift.rb
│   │   │   │   ├── cancel_shift.rb  publish_rota.rb  copy_week.rb
│   │   │   │   ├── assign_staff.rb  unassign_staff.rb  coverage_summary.rb
│   │   │   │   └── validators/{base,overlap,rest_period,weekly_hours,availability}_validator.rb
│   │   │   ├── clocking/
│   │   │   │   ├── record_clock_event.rb  evaluate_geofence.rb  detect_time_anomaly.rb
│   │   │   │   ├── apply_correction.rb  resolve_effective_times.rb  recalculate_assignment.rb
│   │   │   ├── lifecycle/{state_machine,evaluate_assignment,evaluate_all,auto_close_overdue}.rb
│   │   │   ├── alerts/
│   │   │   │   ├── raise.rb  suppress.rb  acknowledge.rb  resolve.rb
│   │   │   │   └── scanners/{missed_shift,late_start,no_clock_out}_scanner.rb
│   │   │   ├── notifications/
│   │   │   │   ├── deliver.rb  resolve_recipients.rb        # returns Admins and/or Employees
│   │   │   │   └── channels/{in_app,push,email}_channel.rb
│   │   │   ├── messaging/
│   │   │   │   ├── create_conversation.rb        # dedupes 1-to-1 on direct_key
│   │   │   │   ├── add_participants.rb  send_message.rb  mark_read.rb  unread_counts.rb
│   │   │   ├── timesheets/
│   │   │   │   ├── build_period.rb  recalculate_line.rb  approve_period.rb  lock_period.rb
│   │   │   │   ├── raise_dispute.rb  and exporters/{csv,xlsx}_exporter.rb
│   │   │   └── sync/{ingest_batch,build_changeset,cursor}.rb
│   │   ├── jobs/
│   │   │   ├── shifts/generate_upcoming_job.rb          # nightly
│   │   │   ├── lifecycle/evaluate_states_job.rb         # every 1 minute
│   │   │   ├── alerts/scan_shifts_job.rb                # every 1 minute
│   │   │   ├── notifications/{deliver_job,retry_failed_job}.rb
│   │   │   ├── messaging/notify_unread_job.rb
│   │   │   └── timesheets/{recalculate_job,open_next_period_job}.rb
│   │   ├── channels/
│   │   │   ├── application_cable/{connection,channel}.rb  # connection identifies Admin|Employee
│   │   │   ├── live_board_channel.rb   conversation_channel.rb
│   │   │   ├── presence_channel.rb     notifications_channel.rb
│   │   ├── mailers/{application,admin,employee,rota,alert,timesheet,message}_mailer.rb
│   │   ├── serializers/               # admin_, employee_, shift_, clock_event_, alert_,
│   │   │                              # timesheet_, conversation_, message_, notification_
│   │   ├── policies/                  # AdminPolicy, EmployeePolicy, ShiftPolicy, etc.
│   │   ├── queries/{rota_week,live_board,exceptions,coverage_gaps,timesheet_summary,inbox}_query.rb
│   │   └── lib_support/{recurrence/rrule_expander,time/working_time,geo/haversine}.rb
│   ├── config/
│   │   ├── application.rb  routes.rb  database.yml  cable.yml  queue.yml  recurring.yml  deploy.yml
│   │   └── initializers/{current_attributes,jwt,cors,rack_attack,web_push,pundit}.rb
│   ├── db/
│   │   ├── migrate/                   # 001 settings, 002 admins, 003 employees, 004 devices+tokens,
│   │   │                              # 005 events, 006 locations, 007 shift_templates+shifts,
│   │   │                              # 008 shift_assignments, 009 clock_events, 010 alerts,
│   │   │                              # 011 timesheets, 012 conversations+messages, 013 notifications
│   │   ├── schema.rb
│   │   └── seeds/{settings,first_admin}.rb
│   ├── spec/
│   │   ├── services/clocking/{record_clock_event,apply_correction,detect_time_anomaly,evaluate_geofence}_spec.rb
│   │   ├── services/lifecycle/state_machine_spec.rb
│   │   ├── services/messaging/send_message_spec.rb    # polymorphic sender + direct_key dedupe
│   │   ├── services/timesheets/dst_boundary_spec.rb
│   │   ├── requests/api/v1/
│   │   └── support/{auth_helpers,time_helpers,factories}/
│   ├── Dockerfile   Gemfile
│
└── frontend/                         # React 19 + TS + Vite
    ├── src/
    │   ├── main.tsx   App.tsx
    │   ├── routes/
    │   │   ├── index.tsx   ProtectedRoute.tsx
    │   │   ├── auth/
    │   │   │   ├── AdminLoginPage.tsx         # → /admin/auth/login
    │   │   │   ├── CarerLoginPage.tsx         # → /staff/auth/login
    │   │   │   ├── AcceptInvitePage.tsx  ForgotPasswordPage.tsx  MfaPage.tsx
    │   │   ├── admin/
    │   │   │   ├── DashboardPage.tsx  RotaPage.tsx  ShiftTemplatesPage.tsx
    │   │   │   ├── LiveBoardPage.tsx  ExceptionsPage.tsx  TimesheetsPage.tsx
    │   │   │   ├── MessagesPage.tsx   EmployeesPage.tsx  AdminsPage.tsx  SettingsPage.tsx
    │   │   └── staff/
    │   │       ├── MyShiftsPage.tsx  ShiftDetailPage.tsx  MyTimesheetPage.tsx  MessagesPage.tsx
    │   ├── features/
    │   │   ├── auth/
    │   │   ├── rota/components/{WeekGrid,ShiftCell,AssignDrawer,ValidationWarnings,CoverageBar,PublishBanner,CopyWeekDialog}.tsx
    │   │   ├── clocking/{components/{ClockButton,GeoStatus,OfflineBadge},useClock.ts,api.ts}
    │   │   ├── liveBoard/{components/{StaffRow,StatusPill,CountsHeader},useLiveBoard.ts}
    │   │   ├── exceptions/  timesheets/
    │   │   ├── messaging/{components/{ConversationList,MessageThread,MessageComposer,NewConversationDialog,UnreadBadge},useConversation.ts,api.ts}
    │   │   ├── notifications/{components/{NotificationBell,NotificationList},usePushSubscription.ts,useNotifications.ts}
    │   │   └── settings/
    │   ├── offline/{db,outbox,sync,useOnlineStatus,cacheStrategy,serviceWorker}.ts
    │   ├── lib/{apiClient,auth,queryClient,cable,geo,time,permissions,settings,format}.ts
    │   ├── types/{api,models,enums}.ts
    │   ├── components/{ui,layout/{AdminLayout,StaffLayout,AuthLayout},feedback}.tsx
    │   └── styles/index.css
    ├── public/{manifest.webmanifest,icons/}
    ├── vite.config.ts  tsconfig.json  tailwind.config.ts  package.json
    └── tests/e2e/{rota,clock-in-out,offline-queue,messaging}.spec.ts
```

---

## 11. Key API endpoints — Phase 1

```
# Auth — separate per identity
POST   /api/v1/admin/auth/login           → { access, refresh, admin }     # admins table; rejects employees
POST   /api/v1/staff/auth/login           → { access, refresh, employee }  # employees table; rejects admins
POST   /api/v1/auth/refresh
DELETE /api/v1/auth/logout
GET    /api/v1/admin/me     |    GET /api/v1/staff/me

# Admin (office)
GET    /api/v1/admin/rota?from=&to=
POST   /api/v1/admin/shift_templates
POST   /api/v1/admin/shifts
POST   /api/v1/admin/shifts/:id/publish
POST   /api/v1/admin/rota_copies                 # copy_week
POST   /api/v1/admin/shift_assignments           # returns validation warnings
DELETE /api/v1/admin/shift_assignments/:id
GET    /api/v1/admin/live_board
GET    /api/v1/admin/exceptions
POST   /api/v1/admin/clock_corrections           # manual_admin, reason required
POST   /api/v1/admin/alerts/:id/acknowledge
GET    /api/v1/admin/timesheet_periods/:id
POST   /api/v1/admin/timesheet_periods/:id/approve
GET    /api/v1/admin/timesheet_exports/:id       # CSV/XLSX
POST   /api/v1/admin/employees                   # invite carer
POST   /api/v1/admin/admins                      # invite office user
GET/PATCH /api/v1/admin/settings

# Carer (PWA)
GET    /api/v1/staff/shifts?from=&to=
POST   /api/v1/staff/shift_assignments/:id/clock
       { kind, client_event_id, occurred_at, lat, lng, accuracy_m, device_fingerprint }
       → 201 { server_time, lifecycle_state, geofence: pass|fail|no_fix }
       → 200 identical on replay of same client_event_id
       → 422 { error: "too_far", distance_m } when geofence blocks
GET    /api/v1/staff/timesheet?period=
POST   /api/v1/staff/disputes
POST   /api/v1/staff/sync/events                 # batch outbound
GET    /api/v1/staff/sync/changes?since=cursor

# Shared (chat + notifications) — caller may be Admin or Employee
GET    /api/v1/conversations
POST   /api/v1/conversations                     # 1-to-1 dedupes on direct_key
GET    /api/v1/conversations/:id/messages?before=
POST   /api/v1/conversations/:id/messages        { body, client_message_id }
POST   /api/v1/messages/:id/receipts             # mark read
GET    /api/v1/notifications
POST   /api/v1/notifications/:id/seen
GET/PATCH /api/v1/notification_preferences
```

---

## 12. Build order (week 1)

| Day | Deliver |
|-----|---------|
| 1 | Rails API skeleton, CI, Kamal to UK host; settings; **admins + employees tables**; auth (JWT+MFA) with two login services; events table + `Events::Record` |
| 2 | Locations; shift_templates; `Shifts::GenerateFromTemplates`; publish flow |
| 3 | Assignments (employee_id) + validators; rota controller/queries; React rota grid + publish |
| 4 | Clock endpoint (idempotency, geofence block/no_fix, skew); staff PWA clock in/out + offline outbox |
| 5 | Lifecycle FSM + 1-min evaluator; alert scanners; live board (cable); exceptions + corrections; chat (polymorphic participants) both apps |
| 6 | Timesheets: build/recalculate/approve/lock + CSV/XLSX; disputes; notifications + push |
| 7 | Test pass; UAT on real phones; go-live |

## 13. Tests that must pass

1. **Idempotent replay** — same `client_event_id` twice → one clock event, identical response.
2. **Correction chain** — original → correction → correction resolves to the last; superseded still visible; `effective_clock_events` correct.
3. **DST** — a 23:00–07:00 shift is 7h in March, 9h in October; hours attributed to shift start date.
4. **FSM** — every transition in §6, including grace-expiry → missed and auto-close.
5. **Geofence** — pass within radius; fail (blocked, no event) outside; no_fix allowed + alerted.
6. **Clock skew** — device 30 min fast → `time_anomaly`, routed to pending_review, not rejected.
7. **Offline** — queue 3 events offline, reconnect, all land in order with correct `occurred_at`.
8. **Chat polymorphic** — an Admin and an Employee in one thread; 1-to-1 dedupes on `direct_key` across the two types; message send idempotent on `client_message_id`; unread count correct for both participant types.
9. **Login isolation** — an employee's credentials are rejected at `/admin/auth/login`, and vice-versa.

## 14. Things deliberately NOT in Phase 1

care plans, assessments, eMAR, employee HR detail (DBS/training/supervision), invoicing, pay/NMW, incidents, audits, reports, daycare, navigation/maps, family portal, AI note composition. All arrive in Phase 2 and attach to this foundation. (**Service users & visits moved INTO Phase 1** — see §1a.)

---

## Note on the two-identity design

Admin and Employee are separate tables with separate logins, as specified. The cost, so the LLM handles it correctly: (1) any "who did this / who receives this" reference that can be either kind is **polymorphic** (`*_type` + `*_id`) — devices, refresh_tokens, events.actor, clock_events.created_by, all chat tables, notifications; (2) email uniqueness is enforced **within** each table but not across both, so the same email could exist as an Admin and an Employee — acceptable if a person can genuinely hold both roles, otherwise add an app-level cross-check on invite; (3) `Authenticatable` concern shares the auth plumbing so the two models don't duplicate it.
```