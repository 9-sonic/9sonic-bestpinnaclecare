# 9Sonic Clock In/Out — Product Backlog for Best Pinnacle Care (15-Day Build)

## MoSCoW Reasoning for This Build
You are working with two part-time freelancers who have already started the backend informally, and you have 15 calendar days of development before a 7-day testing phase. That means the Must column below is deliberately ruthless: it contains only the smallest set of user stories that still lets Best Pinnacle Care demo the core product promise—carers clock in and out (even offline), managers see a live board with late and missed alerts, and timesheets flow straight to payroll export. Everything else is ranked by risk and day-job availability. Should items add operational polish (exceptions queue, PIN tablet, grace settings) that make the demo credible to a CQC-minded audience. Could items are pure nice-to-haves that earn time only if a freelancer finishes a Medium story faster than expected. Won’t items are explicitly deferred to Stage 2 so the team does not bleed scope into the full care-management platform. If you paste these into GitHub Issues, create the Must items first, lock them to Milestone `Sprint 1 — Foundation`, and tag owners immediately so the freelancers know what is non-negotiable.

---

## Must

### M1 — Carer PWA Login
**As a carer, I want to log in securely from my phone so that only I can see my shifts and clock records.**

Acceptance Criteria:
- [ ] Carer opens the PWA and sees a login screen with email and password fields.
- [ ] Carer enters valid credentials and taps "Log In"; the frontend sends a POST request to `/api/auth/login`.
- [ ] Backend validates the password hash and returns a signed JWT containing the carer’s `userId` and `role: carer`.
- [ ] Frontend stores the JWT in `localStorage` and redirects to the dashboard.
- [ ] If credentials are invalid, the frontend displays the exact error message "Invalid email or password" and clears the password field.
- [ ] Any unauthenticated request to a protected route is intercepted and redirected to the login screen.

**Owner:** FE  
**Size:** S  
**Tags:** `pwa`, `auth`, `must`

### M2 — Manager Web Login
**As a manager, I want to log in with role-based access so that I can reach the admin dashboard and live board.**

Acceptance Criteria:
- [ ] Manager opens the admin web app and sees a login screen with email and password fields.
- [ ] Manager enters valid credentials; the frontend sends a POST request to `/api/auth/login`.
- [ ] Backend validates credentials and returns a JWT with `role: manager` or `role: admin`.
- [ ] Frontend stores the JWT and routes the manager to `/dashboard` on success.
- [ ] If a carer’s credentials are used, the backend returns 403 and the frontend shows "Access denied: manager accounts only."
- [ ] The navigation sidebar hides manager-only links (Live Board, Shift Assign, Timesheets) when the JWT role is not `manager`.

**Owner:** FE/BE  
**Size:** S  
**Tags:** `admin-web`, `auth`, `must`

### M3 — Backend Foundation & UK Hosting
**As a 9Sonic operator, I want the backend deployed in the UK with encrypted backups and an immutable audit trail so that Best Pinnacle Care meets CQC and NHS data security expectations.**

Acceptance Criteria:
- [ ] PostgreSQL database and API server are provisioned in a UK cloud region (e.g., AWS `eu-west-2` or Azure `UK South`).
- [ ] All API traffic enforces TLS 1.3; database storage uses AES-256 encryption at rest.
- [ ] Nightly encrypted backups are configured with a 7-day retention window and a documented recovery test path.
- [ ] Every database mutation triggers an append-only audit log entry recording `userId`, `action`, `tableName`, `recordId`, `oldValue`, `newValue`, and `timestamp`.
- [ ] Role-based access control middleware is enforced on every route; carer tokens cannot access manager endpoints.
- [ ] Environment variables for secrets (DB password, JWT secret) are stored outside the monorepo and injected at runtime.

**Owner:** BE  
**Size:** L  
**Tags:** `backend`, `compliance`, `infrastructure`, `must`

### M4 — Shift Assignment (Manager Web)
**As a manager, I want to create and assign shifts to carers so that there is a scheduled visit for the carer to clock in and out against.**

Acceptance Criteria:
- [ ] Manager navigates to "Shifts > Create Shift" and selects a carer, date, start time, end time, and location address from a form.
- [ ] Backend validates that the selected carer does not have an overlapping shift and returns 409 if they do.
- [ ] On successful creation, the shift appears in the carer’s PWA dashboard within 5 seconds (poll or push).
- [ ] Manager can view a list of all shifts for a selected date range and filter by carer name or status.
- [ ] Manager can delete a future shift; deleting a shift that already has a clock-in event is blocked and returns an error message.
- [ ] The shift record stores `scheduledStart`, `scheduledEnd`, `locationLat`, `locationLng`, and `carerId`.

**Owner:** FE/BE  
**Size:** M  
**Tags:** `admin-web`, `shifts`, `must`

### M5 — Carer Dashboard (PWA)
**As a carer, I want to see my assigned shifts for today so that I know which visit to start and when.**

Acceptance Criteria:
- [ ] PWA loads the dashboard and calls `GET /api/shifts?date=today&carerId=me` using the JWT.
- [ ] The dashboard displays a scrollable list of shift cards sorted by start time.
- [ ] Each card shows the shift label (or client pseudonym), scheduled start time, scheduled end time, and address.
- [ ] Tapping a card navigates to the Clock In / Clock Out action screen for that shift.
- [ ] If no shifts are assigned, the dashboard shows the message "No shifts scheduled for today" and a refresh button.
- [ ] The dashboard header displays the carer’s first name and the current date.

**Owner:** FE  
**Size:** S  
**Tags:** `pwa`, `dashboard`, `must`

### M6 — Clock In / Clock Out with Time & Location
**As a carer, I want to clock in and out with a single tap so that my attendance is recorded with an accurate timestamp and GPS location.**

Acceptance Criteria:
- [ ] The Clock In / Clock Out screen shows a large "Clock In" button when the shift is scheduled and no clock-in exists yet.
- [ ] Tapping "Clock In" captures the device’s current timestamp and GPS coordinates using the Geolocation API.
- [ ] The button then changes to "Clock Out"; tapping it captures a second timestamp and GPS coordinate pair.
- [ ] The frontend sends a POST to `/api/clock-events` with `shiftId`, `type` (`in` or `out`), `timestamp`, `lat`, and `lng`.
- [ ] Backend stores the event in the `clock_events` table and updates the shift status to `clocked_in` or `completed`.
- [ ] Location is captured only at the moment of the tap; the PWA does not request location in the background or between shifts.

**Owner:** FE/BE  
**Size:** M  
**Tags:** `pwa`, `clockin`, `location`, `must`

### M7 — Offline Clock In/Out Sync
**As a carer working in areas with poor mobile signal, I want my clock taps saved on my phone and sent automatically when I reconnect so that no shift record is ever lost.**

Acceptance Criteria:
- [ ] When the PWA detects it is offline (via `navigator.onLine` and failed ping), clock taps are stored in an IndexedDB queue named `pendingClockEvents`.
- [ ] Each queued event includes `shiftId`, `type`, `timestamp`, `lat`, `lng`, and a client-generated UUID for deduplication.
- [ ] A "Sync pending — X records" badge is visible on the dashboard when the queue is non-empty.
- [ ] On reconnect, the PWA iterates the queue and POSTs each event to `/api/clock-events` in chronological order.
- [ ] Backend checks the UUID; if it already exists, the event is ignored and 200 is returned so the client can dequeue it.
- [ ] Once synced, the badge changes to "All records synced" and the queue is cleared.

**Owner:** FE/BE  
**Size:** L  
**Tags:** `pwa`, `offline`, `sync`, `must`

### M8 — Live Board Monitoring
**As a manager, I want a live board that updates in real time so that I can see who is on shift, who is late, and who has not arrived without refreshing the page.**

Acceptance Criteria:
- [ ] Manager opens "Live Board" and sees a table or card view of all shifts scheduled for the current day.
- [ ] Each row shows carer name, scheduled start, actual clock-in time (or "—"), current status, and location.
- [ ] Status is colour-coded: On Time (green), Late (amber), Missed (red), Not Started (grey), Clocked Out (blue).
- [ ] The board refreshes automatically every 30 seconds via polling or WebSocket push when a clock event is received.
- [ ] Manager can filter the board by carer name, shift status, or site location.
- [ ] The board is accessible only to users with `manager` or `admin` role.

**Owner:** FE/BE  
**Size:** M  
**Tags:** `admin-web`, `live-board`, `must`

### M9 — Late & Missed Shift Alerts
**As a manager, I want the system to detect late and missed shifts automatically so that I am alerted while the shift is still live and can take action.**

Acceptance Criteria:
- [ ] Backend runs a scheduled job every minute comparing `scheduledStart` against the latest `clock_events` for each active shift.
- [ ] If no clock-in exists within the configured late grace period (default 5 minutes), the shift status changes to `late` and an in-app alert is created.
- [ ] If no clock-in exists within the configured missed grace period (default 15 minutes), the status changes to `missed` and a critical alert is raised.
- [ ] Alerts appear in the manager’s "Exceptions" bell icon and as a browser push notification if permissions are granted.
- [ ] Each alert contains a deep link to the specific shift row on the Live Board.
- [ ] The alert record and the grace rules applied are written to the audit log.

**Owner:** BE  
**Size:** M  
**Tags:** `backend`, `alerts`, `automation`, `must`

### M10 — Timesheet Calculation & Approval
**As a manager, I want hours calculated automatically from verified clock data so that I can review and approve payroll without manual arithmetic.**

Acceptance Criteria:
- [ ] Backend calculates total hours per shift as the difference between clock-out and clock-in timestamps, rounded to the nearest minute.
- [ ] Manager navigates to "Timesheets" and selects a period (weekly, fortnightly, or four-weekly); the backend aggregates hours by carer.
- [ ] Each line shows carer name, total shifts, total hours, and approval status (Pending / Approved / Rejected).
- [ ] Manager can approve or reject an entire carer timesheet with one click; rejection moves the line to the exceptions queue for correction.
- [ ] Approved timesheets are locked from further edits unless a manager explicitly reverses approval, which is audit-logged.
- [ ] The calculation excludes shifts that have no clock-out event and flags them in the exceptions queue.

**Owner:** FE/BE  
**Size:** M  
**Tags:** `admin-web`, `timesheets`, `must`

### M11 — Timesheet Export to CSV/Excel
**As a manager, I want to export approved timesheets so that I can send them to my payroll provider in a standard format.**

Acceptance Criteria:
- [ ] On the Timesheets page, an "Export" button appears only when at least one timesheet is approved.
- [ ] Manager selects the period and clicks "Export to CSV" or "Export to Excel".
- [ ] The backend generates a file containing columns: Carer Name, Shift Date, Clock In, Clock Out, Hours Worked, Location, Approval Date.
- [ ] The file downloads directly in the browser using a presigned URL or streamed blob.
- [ ] The export filename includes the period range, e.g., `timesheet_2026-07-17_2026-07-23.csv`.
- [ ] A record of the export is written to the audit log with the manager’s ID and timestamp.

**Owner:** FE/BE  
**Size:** S  
**Tags:** `admin-web`, `timesheets`, `export`, `must`

---

## Should

### S12 — Carer Profile (PWA)
**As a carer, I want to view and update my profile so that my contact details and emergency PIN are always accurate.**

Acceptance Criteria:
- [ ] Carer taps "Profile" from the dashboard bottom navigation and sees read-only fields: name, email, role.
- [ ] Editable fields include phone number, password, and emergency contact name.
- [ ] Tapping "Save" calls `PATCH /api/users/me` with the changed fields only.
- [ ] Backend validates the phone number format and returns a success toast or field-level error.
- [ ] Profile photo upload is out of scope; a placeholder avatar is shown.
- [ ] Changes reflect immediately in the manager’s staff list view.

**Owner:** FE/BE  
**Size:** S  
**Tags:** `pwa`, `profile`, `should`

### S13 — Manager Exceptions Queue & One-Click Correction
**As a manager, I want all late, missed, and forgotten clock-outs gathered in one queue so that I can resolve them quickly with a full audit trail.**

Acceptance Criteria:
- [ ] The "Exceptions" page lists every shift flagged as Late, Missed, or Missing Clock-Out, sorted by most recent first.
- [ ] Each row shows carer name, scheduled time, exception type, and a "Resolve" button.
- [ ] Clicking "Resolve" opens a modal where the manager enters the corrected clock time and a mandatory reason text.
- [ ] Backend appends the correction to the `audit_log` with `managerId`, `reason`, `correctedTime`, and `originalRecordId`.
- [ ] The original clock event row is never overwritten; the shift displays both original and corrected times.
- [ ] Resolved exceptions drop from the open queue but remain searchable in an "Exceptions History" tab.

**Owner:** FE/BE  
**Size:** M  
**Tags:** `admin-web`, `exceptions`, `audit`, `should`

### S14 — Location Checking Modes
**As a manager, I want to configure whether location is recorded for reference only, triggers a warning, or blocks clock-in so that the system fits each site’s operational rules.**

Acceptance Criteria:
- [ ] Admin settings page includes a dropdown per site: "Record Only", "Warn", or "Strict".
- [ ] In "Warn" mode, if the carer’s GPS is more than 100 metres from the shift location, the PWA shows a yellow banner "You are far from the site—clock in anyway?" and logs the deviation.
- [ ] In "Strict" mode, the clock-in button is disabled if the GPS deviation exceeds 100 metres; the carer sees "Clock in blocked: please move closer to the site."
- [ ] In "Record Only" mode, the clock-in proceeds silently and the deviation is stored for later review.
- [ ] The distance calculation uses the Haversine formula between the shift `locationLat/Lng` and the device coordinates.
- [ ] The selected mode is stored in the `sites` table and cached in the PWA on dashboard load.

**Owner:** FE/BE  
**Size:** M  
**Tags:** `pwa`, `admin-web`, `location`, `should`

### S15 — PIN Tablet Clock In/Out
**As a carer without a smartphone, I want to clock in and out on a wall-mounted PIN tablet so that I am included in the digital attendance record.**

Acceptance Criteria:
- [ ] A dedicated tablet frontend runs at `/tablet` and displays a numeric keypad and staff ID entry field.
- [ ] Carer enters their personal 4-digit PIN; backend validates PIN against `users.pinHash` and returns a short-lived session token.
- [ ] The tablet records the clock event using the tablet’s fixed `deviceLocation` (configured in admin settings) instead of GPS.
- [ ] The UI is large, high-contrast, and designed for wall-mounted touchscreens with no other app navigation visible.
- [ ] After clock-in or clock-out, the tablet shows a full-screen confirmation for 3 seconds, then resets to the PIN entry screen.
- [ ] Manager can pair a tablet to a site and view its last-sync timestamp in admin settings.

**Owner:** FE/BE  
**Size:** M  
**Tags:** `hardware`, `pin-tablet`, `should`

### S16 — Grace Period Configuration
**As a manager, I want to set grace periods for lateness and early leaving so that alerts match Best Pinnacle Care’s operational reality rather than a hard-coded default.**

Acceptance Criteria:
- [ ] Admin settings page shows numeric inputs: "Late Grace (minutes)" and "Early Leave Grace (minutes)".
- [ ] Backend reads these values from the `organisation_settings` table when evaluating shift status.
- [ ] Changing the value updates the configuration immediately and applies to all future shift evaluations on the next cron tick.
- [ ] Input validation enforces integers between 0 and 60.
- [ ] A tooltip explains: "Late grace is the number of minutes after the scheduled start before a shift is flagged as late."
- [ ] The current values are returned by `GET /api/settings` so the PWA can display them to carers if needed.

**Owner:** FE/BE  
**Size:** S  
**Tags:** `admin-web`, `settings`, `should`

---

## Could

### C17 — Maps & Navigation (PWA)
**As a carer, I want to view my shift address on a map and open my phone’s navigation app so that I can find the client’s home without typing the address.**

Acceptance Criteria:
- [ ] Shift detail screen displays a static map thumbnail centred on the shift location using an embedded map image or lightweight library.
- [ ] Tapping the map thumbnail opens the native maps app (Google Maps on Android, Apple Maps on iOS) with the destination address pre-filled.
- [ ] The PWA does not implement turn-by-turn directions or track the carer’s route between visits.
- [ ] If the shift has no location coordinates, the map area shows "No map available" and the address text is still displayed.
- [ ] Map tile requests respect the user’s data connection and do not block the clock-in/out action.

**Owner:** FE  
**Size:** S  
**Tags:** `pwa`, `maps`, `could`

### C18 — In-App Chat (Manager & Carer)
**As a manager, I want to send direct messages and group announcements to carers so that I can coordinate shift changes without leaving the platform.**

Acceptance Criteria:
- [ ] Manager opens "Messages" from the admin sidebar and selects a carer from a directory list.
- [ ] Text messages are sent via `POST /api/messages` and stored in a `messages` table with `senderId`, `recipientId`, `body`, and `timestamp`.
- [ ] Carer sees unread messages in a PWA inbox icon; tapping opens the thread.
- [ ] Manager can send a broadcast message to all carers currently marked "On Shift" on the live board.
- [ ] Messages are retained for 30 days; older messages are soft-deleted and hidden from the UI.
- [ ] Push notifications for new messages are optional and only sent if the user has granted browser notification permission.

**Owner:** FE/BE  
**Size:** L  
**Tags:** `pwa`, `admin-web`, `chat`, `could`

### C19 — SMS Alert Escalation
**As a manager, I want critical missed-visit alerts sent by SMS if I do not acknowledge them in the app within 2 minutes so that I am covered when I am away from my desk.**

Acceptance Criteria:
- [ ] Backend monitors the `alerts` table for `missed` type alerts with `acknowledgedAt` still null after 2 minutes.
- [ ] An SMS is sent via a provider (e.g., Twilio) to the on-duty manager’s mobile number stored in their profile.
- [ ] The SMS body contains: "MISSED VISIT: [Carer Name] at [Shift Time]. Open live board: [URL]."
- [ ] Manager replies "OK" to the SMS number; backend receives the webhook and marks the alert as acknowledged.
- [ ] If the manager has acknowledged in-app before the 2-minute threshold, no SMS is sent.
- [ ] Each SMS attempt is logged in the audit trail with cost reference for billing review.

**Owner:** BE  
**Size:** M  
**Tags:** `backend`, `sms`, `alerts`, `could`

### C20 — Push Notifications for Carers
**As a carer, I want to receive a push reminder 15 minutes before my shift starts so that I am less likely to forget or be late.**

Acceptance Criteria:
- [ ] Carer opts in to push notifications on first dashboard load; the PWA registers a service worker and subscribes to the push manager.
- [ ] Backend schedules a push notification for each shift 15 minutes before `scheduledStart` using a queue or cron job.
- [ ] The notification title reads "Shift starting soon" and the body shows the shift time and address.
- [ ] Tapping the notification focuses the PWA and opens the correct shift detail screen.
- [ ] If the carer has already clocked in, the scheduled push is cancelled automatically.
- [ ] A "Notifications" toggle is available in the carer profile settings.

**Owner:** FE/BE  
**Size:** M  
**Tags:** `pwa`, `notifications`, `could`

---

## Won’t

### W21 — Rota Builder & Recurring Patterns
**As a manager, I want to define recurring rota templates (earlies, lates, nights) so that shifts generate automatically each week.**

Acceptance Criteria:
- [ ] This feature is explicitly deferred to Stage 2 (Weeks 3–5) of the full Care Management System.
- [ ] For the 15-day build, shifts are created manually via the Shift Assignment screen or imported via a simple CSV bulk upload if time permits.
- [ ] No database tables for `rota_templates` or `recurring_rules` are created in Sprint 1.

**Owner:** BE  
**Size:** L  
**Tags:** `admin-web`, `rota`, `wont`

### W22 — eMAR Medication Module
**As a carer, I want to record medication doses (given, refused, missed) so that medication errors are tracked and flagged.**

Acceptance Criteria:
- [ ] Deferred to Stage 2 per the technical plan; not required for the Clock In / Clock Out foundation.
- [ ] No `medications`, `doses`, or `emar_events` tables are provisioned in the 15-day build.
- [ ] If a client requires medication tracking during the pilot, it is handled on paper and noted in visit comments manually.

**Owner:** BE  
**Size:** L  
**Tags:** `pwa`, `emar`, `wont`

### W23 — Client Profiles & Assessments
**As a manager, I want to store client care plans, assessments, and documents so that carers have full context before each visit.**

Acceptance Criteria:
- [ ] Deferred to Stage 2; the 15-day build uses a minimal `clients` table with name and address only to support shift location.
- [ ] No document upload, e-signature, or assessment versioning is built in Sprint 1.
- [ ] Carer PWA shows only the client address on the shift card; full care plans are out of scope.

**Owner:** FE/BE  
**Size:** L  
**Tags:** `admin-web`, `clients`, `wont`

### W24 — Finance & Invoicing
**As a manager, I want to generate invoices from completed visits, including local authority formats, so that billing is automated.**

Acceptance Criteria:
- [ ] Deferred to Stage 2; the immediate payroll need is covered by the Timesheet Export story (M11).
- [ ] No `invoices`, `funders`, or `invoice_line_items` tables are created in Sprint 1.
- [ ] If finance data is needed before Stage 2, the approved CSV export is imported manually into the existing payroll software.

**Owner:** BE  
**Size:** L  
**Tags:** `admin-web`, `finance`, `wont`

### W25 — HR Records & DBS Expiry Tracking
**As a manager, I want staff HR records with DBS, right-to-work, and training expiry dates so that compliance is automated.**

Acceptance Criteria:
- [ ] Deferred to Stage 2; the 15-day build maintains only basic user records (`users` table) for authentication and shift assignment.
- [ ] No expiry alerts, supervision scheduling, or leave-request workflows are built in Sprint 1.
- [ ] HR verification continues on the existing spreadsheet or HR system until the full module is delivered.

**Owner:** FE/BE  
**Size:** L  
**Tags:** `admin-web`, `hr`, `wont`