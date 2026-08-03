# API gaps found while wiring up the carer PWA

Running list from frontend. **Second pass**, after the PWA was switched off mock
data and pointed at the live v1 API.

Most of the last list has landed — thank you. This revision clears what is done,
keeps what is still open, and adds what only became visible once the app was
actually talking to the API.

**Priority key:** P1 blocks a carer doing their job. P2 makes a screen work
properly. P3 is a nice to have.

---

## Read this first: what to build, in order

Items marked **✱** should be confirmed against the running API before any work
starts. This list was written from `swagger/v1/swagger.yaml`, and last time the
spec and the controllers disagreed — some of these may already exist and only be
missing from the doc. `client/pwa/scripts/api-probe.mjs` signs in as
`carer@bestpinnacle.test`, calls every route the app uses and prints what comes
back; five minutes with it will settle every ✱ below.

### Tier 1 — the carer app is not trustworthy without these

| # | What | Done when |
| --- | --- | --- |
| 1 | Return `refresh_token` + `access_expires_at` from the three login responses | A carer's session survives a 13-hour shift without a re-login. Frontend needs no change. |
| 6 | Add the 13 undocumented routes to the rswag specs | `swagger.yaml` describes every route the PWA calls, `GET /staff/visits` first. |
| 6 | Fix the four schemas that are thinner than their serializers | `VisitAssignment.actual_start` / `actual_end`, nested `Visit.service_user`, `Visit.notes`, `ServiceUser.phone` / `address_line2` / `city` appear in the spec. |

### Tier 2 — screens exist but cannot do their job

| # | What | Done when |
| --- | --- | --- |
| 2 | `PATCH /staff/visit_assignments/:id/tasks` and `POST .../note` | A ticked task and a written note reach the office. Notes append, keyed on `client_note_id`. |
| 3 | Breaks: `break_start` / `break_end` on the `clock_kind` enum | A break taken shows on the timesheet as taken, not as scheduled. |
| 4 | `GET /staff/mileage?from=&to=` | A carer can see and check a claim they submitted. |
| 5 ✱ | `emergency_contact_name` / `phone` (and `phone`) in `EmployeeSerializer` | What a carer saves comes back on the next read. |

### Tier 3 — worth doing, nothing is broken without them

| # | What |
| --- | --- |
| 7 | Decide the `night` availability slot: screen row, or drop from the enum |
| 7 ✱ | Document the `GET /staff/availability` response shape |
| 2 ✱ | Document the `care_plan`, `tasks` and `notes` item shapes (currently bare `{}`) |
| 8 | List and revoke passkeys |
| 9 | `DELETE /staff/devices/:fingerprint` |
| 10 | Pay rates, if carers are meant to see money |

### Two conventions that would make every future endpoint land cleanly

1. **Keep the error-code pattern.** `{ error: "too_far", distance_m: 4200 }` is
   why the app can tell a carer *how far off* they are instead of "something
   went wrong". The client already branches on `error` and renders a sentence
   per code — every new code you add gets used. Conflict cases would benefit
   most.
2. **Take a client-generated id on anything a carer can submit twice.**
   `client_event_id` on clock events is the reason a dropped connection cannot
   create a duplicate shift. Notes need the same (`client_note_id`), and so
   would mileage claims and messages. Offline is normal here, so every write
   endpoint should assume it will be replayed.

---

## Landed since the last pass

All of these are now wired in `src/api/` and no longer running on local data:

| Was | Now | Wired in |
| --- | --- | --- |
| No carer profile edit | `PATCH /staff/me` | `api/auth.js` |
| No availability | `GET` + `PUT /staff/availability` | `api/auth.js` |
| No single visit endpoint | `GET /staff/visit_assignments/:id` | `api/shifts.js` |
| No carer summary | `GET /staff/summary` | `api/stats.js` + `adapters.toSummary` |
| Mark all read fanned out | `POST /notifications/seen_all` | `api/notifications.js` |
| Devices never registered | `POST /staff/devices` | `api/devices.js`, called on sign-in |
| Chat participants were bare ids | conversations now carry names + preview | `adapters.toThread` |
| No mileage anywhere | `POST /staff/mileage` | see gap 4 below — the read side is missing |
| No token refresh | `POST /auth/refresh` | `api/client.js` — see gap 1, it cannot be used yet |

Two of those cannot actually run yet. They are below.

---

## 1. Login still returns no refresh token (P1)

`POST /api/v1/auth/refresh` exists now and the client implements it: single
flight, rotation, retry the original request once, sign out only if the refresh
itself fails. It is dormant, because there is no way to obtain a refresh token
in the first place.

`POST /staff/auth/login` is documented as returning `{ access, employee }`. The
refresh endpoint returns `{ access, access_expires_at, refresh_token, employee }`.
So the only way to get a refresh token is to already have one.

**Suggested:** return `refresh_token` and `access_expires_at` from
`/staff/auth/login`, `/auth/mfa` and `/staff/webauthn/authentication` — the same
three responses that hand out an `access` token today.

`src/api/auth.js` already stores both if they appear, so this needs no frontend
change. It starts working the day the login response carries them.

This is P1 for the same reason as last time: a carer works 07:00 to 20:00 with
the screen locked. An access token expiring mid-round puts a sign-in screen in
front of someone standing on a doorstep, and takes the offline outbox with it.

---

## 2. Visit tasks and notes are readable but not writable (P2)

`GET /staff/visit_assignments/:id` returns `care_plan`, `tasks` and `notes` —
this was the largest gap on the last list and it is closed on the read side.
The Shift Detail screen now shows the real care plan.

There is still nothing to write back. The task checklist and the notes box on
that screen save to local storage, so a carer ticking off medication is
recording it on their own phone and nowhere else.

**Suggested** (unchanged from last time):

```
PATCH /api/v1/staff/visit_assignments/:id/tasks   { tasks: [ { id, done } ] }
POST  /api/v1/staff/visit_assignments/:id/note    { body, client_note_id }
```

`client_note_id` for the same reason as `client_event_id`: a carer writing notes
in a dead zone submits when signal returns, and must not create two notes.

Also worth documenting: the spec types `care_plan`, `tasks` and `notes` as bare
`{}` objects, so the item shapes are unknown to us. `adapters.js` reads
`label`/`title`, `done`/`completed_at`, `body` and `created_at` defensively.
Confirm the real field names and we will tighten it.

---

## 3. Breaks are still not recorded (P2)

No change since the last list, and the reasoning is unchanged: `break_minutes`
exists on both the visit and the timesheet line, but nothing captures a carer
starting or ending one. The Clock screen's Break button pauses a local timer, so
the figure reaching the timesheet is the scheduled break, not the real one.

Preference remains adding `break_start` and `break_end` to the `clock_kind`
enum, so breaks inherit idempotency, geofencing and the audit trail from the
clock pipeline rather than growing a parallel one.

---

## 4. Mileage is write-only (P2)

`POST /staff/mileage` exists. There is no way to read it back:

```
GET /api/v1/staff/mileage?from=&to=   ->  [ MileageClaim ]
```

`GET /staff/summary` does return a `miles` total, which covers the Overview
figure. But a carer who has submitted a claim cannot see it, check its state, or
correct it, so the app cannot offer a mileage screen at all.

Still worth a decision from Jesse and Best Pinnacle on whether mileage is
claimed by the carer or calculated from the rota.

---

## 5. Emergency contact goes in but may not come back (P2)

`PATCH /staff/me` accepts `emergency_contact_name` and
`emergency_contact_phone`. The documented `Employee` schema contains neither, so
we cannot tell whether a read returns them.

If they are not serialised, the carer types them, the request succeeds, and the
field is empty again next time the screen opens — which looks exactly like data
loss to the person using it.

**Suggested:** add both to `EmployeeSerializer` and to the `Employee` schema. If
they already are serialised, this is a one-line spec fix.

The same question applies to `phone`: the app reads `employee.phone`, and it is
not in the documented schema either.

---

## 6. The spec still does not cover everything the PWA calls (P1, documentation)

Better than last time — 41 paths documented, up from 15. But the carer app
depends on nine routes that are still not in `swagger/v1/swagger.yaml`:

```
GET   /api/v1/staff/visits                 the core visit list — every screen
GET   /api/v1/staff/timesheet
POST  /api/v1/staff/disputes
GET   /api/v1/notifications
POST  /api/v1/notifications/:id/seen
GET   /api/v1/notification_preferences
PATCH /api/v1/notification_preferences
POST  /api/v1/staff/auth/password          only the admin variant is documented
PUT   /api/v1/staff/auth/password
GET   /api/v1/conversations/:id/messages
POST  /api/v1/conversations/:id/messages
POST  /api/v1/conversations
POST  /api/v1/messages/:id/receipts
```

`GET /staff/visits` is the one that matters most: it backs the shift list, the
clock status and the Home screen, and a reader of the spec would conclude it
does not exist.

We are working from the controllers again, as agreed. But the spec is meant to
be the contract, and right now it cannot be used as one.

### Schema drift

Where a schema does exist it is thinner than the serializer:

- `VisitAssignment` has no `actual_start` or `actual_end`. The app reads both —
  they are the clock-in and clock-out times shown to the carer.
- `Visit` has no nested `service_user`, only `service_user_id`. The app relies
  on the nested object for the name, address and geofence.
- `Visit` has no `notes`.
- `ServiceUser` has no `phone` (the call button on the visit screen uses it),
  no `address_line2` and no `city`, all three of which the address line joins.

None of this is urgent if the serializers are right. It matters because the next
person to work from the spec will build the wrong thing.

---

## 7. Availability has a slot the screen cannot set (P3)

The enum is `morning | afternoon | evening | night`. The Availability screen
renders the first three. `PUT` replaces the pattern, so a naive save would
assert `night: false` for every day and silently clear something the carer
cannot see.

The client works around it: it reads the current pattern before saving and
carries `night` through untouched. That costs an extra request per save and is
the sort of workaround that quietly breaks.

**Decision needed:** either the screen grows a Night row — a question for
Athaliah and for Best Pinnacle, since it depends on whether night work is
offered — or `night` comes out of the enum.

Also: the `GET` response is documented only as "weekly pattern", with no schema.
`adapters.toAvailabilityDays` accepts three plausible shapes because we could
not tell which one to expect. Worth pinning down.

---

## 8. No endpoint to list or revoke passkeys (P3)

Unchanged. Registration and authentication both work; there is no way to see
which devices hold a passkey or remove one when a phone is lost. Preferences can
only forget the credential locally, which does not stop the old phone signing
in — so a lost phone stays a working key.

```
GET    /api/v1/staff/webauthn/credentials       ->  [ { id, nickname, last_used_at } ]
DELETE /api/v1/staff/webauthn/credentials/:id   ->  204
```

`webauthn_credentials` already has `nickname` and `last_used_at`.

---

## 9. Device registration is one-way (P3)

`POST /staff/devices` landed and the app now registers on every sign-in. There
is no delete:

```
DELETE /api/v1/staff/devices/:fingerprint
```

Without it, a carer who signs out on a borrowed phone leaves that device
registered against their account for push.

---

## 10. Pay rates and contracted hours (P3)

`GET /staff/summary` returns `contracted_minutes`, which fixed the Home screen's
weekly target — it no longer assumes 40. Thank you.

Pay is still absent: no hourly rate on `employees`, no rate card, so the
Timesheet screen shows hours and no money. That remains deliberate on our side —
a wrong number next to a pound sign is something people plan their week around.
If carers are meant to see expected pay, rates need to exist.

---

## Smaller notes

- **Timesheet still has no period context.** Lines carry a
  `timesheet_period_id` with no way to fetch the period, so the app cannot show
  which week it is looking at or whether it has been approved. A
  `GET /staff/timesheet_periods` would fix it.
- **No pagination anywhere.** Conversations, messages and notifications all
  return complete lists.
- **Error codes are still good.** `{ error: "too_far", distance_m: 4200 }` lets
  us tell a carer how far off they are. More of that on the conflict cases.
- **`GET /staff/visits` defaults to a seven day window** and this is still not
  documented anywhere a reader would find it.

---

## What the frontend does in the meantime

| Gap | What the app does now | Changes needed after |
| --- | --- | --- |
| Refresh token | Refresh implemented but dormant; 401 signs the carer out | None — starts working when login returns one |
| Visit tasks and notes | Reads real ones, writes locally | Point the two writes at the endpoints |
| Breaks | Local timer only | Point at the endpoint |
| Mileage read | Total only, from the summary | Add a mileage screen |
| Emergency contact | Sends it, cannot confirm it comes back | None if it is already serialised |
| Availability night slot | Read-modify-write to preserve it | Drop the workaround |
| Passkey management | Forgets locally only | Add list and revoke |
| Device deregistration | Registers, never removes | Call delete on sign-out |
| Pay | Shows hours, no money | Add pay to timesheet |

The API layer is still isolated in `src/api/`, one call per function, so each of
these stays a small change on our side.
