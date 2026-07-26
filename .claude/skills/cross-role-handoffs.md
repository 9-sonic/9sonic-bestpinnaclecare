# Skill: Cross-role handoffs

**Purpose:** Move work cleanly between **Athaliah Kisochi (UI/UX)**, **Dennis Kabui (FE)**, **Ian Ndegwa (BE)**, **Gichogu Macharia (PM/environment)**, and **Jesse Ngari (client)** — without controlling craft or dropping visibility.

**Use when:** Design is ready enough to build; API contract must land; client answer unblocks engineering; environment blocks someone; review needs another specialty; a client decision needs to be broadcast to the team.

---

## Handoff principles

1. **Outcome first** — what should be true after the next person acts.  
2. **States, not only screenshots** — offline, error, empty, permission, retry.  
3. **One visible ticket** (`BPC-xxx`) as the spine; artifacts hang off it.  
4. **Explicit open questions** — especially client policy vs craft.  
5. **Pull, don’t push-control** — specialists accept method; handoff offers clarity.  
6. **Close the loop** — “landed / blocked / needs you again” comment on the ticket.

---

## Pattern map

```text
Jesse (client intent)
    ↓ confirmed / clarified
Linear BPC-xxx
    ↙        ↓        ↘
Athaliah   Dennis    Ian
 (UX)       (FE)     (BE)
    ↘        ↓        ↙
      PR + review
         ↓
   Gichogu (visibility rails if stuck)
```

Not every item visits every person. Skip steps that don’t apply; don’t invent ceremony.

---

## Athaliah → Dennis (design to frontend)

### When

Current experience improvement is ready enough that Dennis can implement a slice without guessing the user moment.

### Before handing off (Athaliah’s checklist)

- [ ] Figma file/frame link is included and viewable by Dennis
- [ ] All relevant states are designed (default, loading, empty, error, offline, success, edge cases)
- [ ] Copy/text is final or marked as draft
- [ ] Any motion/interaction notes are attached
- [ ] Out-of-scope items are explicitly listed
- [ ] Open questions (needs Ian? needs Jesse?) are called out
- [ ] The ticket (`BPC-xxx`) is linked and the handoff comment is posted

### Handoff packet

Copy and paste the block below into the Linear ticket as a comment, then fill in the bracketed parts.

```markdown
## BPC-xxx — UX handoff for Dennis

### User moment
[e.g. Carer clocks in with no signal]

### Goal of this slice
[What should feel true after Dennis implements]

### Figma link
[Paste full Figma file/frame URL — ensure Dennis has view access]

### Flow (steps)
1. …
2. …
3. …

### States to implement

| State | UI behaviour | Copy / messaging | Figma frame reference |
| --- | --- | --- | --- |
| Default | [e.g. Clock-in button visible, idle] | "Clock In" | Frame: Default |
| Loading | [e.g. Spinner on button, disabled] | "Clocking in…" | Frame: Loading |
| Offline queued | [e.g. Button shows checkmark + "Queued" badge] | "Queued — will sync when online" | Frame: Offline-Queued |
| Sync failed | [e.g. Red badge, retry option] | "Sync failed. Tap to retry." | Frame: Sync-Failed |
| Success | [e.g. Green confirmation, time displayed] | "Clocked in at 08:03" | Frame: Success |
| Location unavailable | [e.g. Warning icon, explanation text] | "Location not available. Clock-in recorded without location." | Frame: Location-Unavailable |
| Empty state | [e.g. No shifts today message] | "No shifts scheduled for today." | Frame: Empty |
| Error (server) | [e.g. Toast with error message] | "Something went wrong. Please try again." | Frame: Error |

### Out of scope this slice
- [e.g. Manager override UI]
- [e.g. Historical timesheet view]

### Open questions
- Needs Ian? [e.g. Does the API return a `syncStatus` field yet?]
- Needs Jesse/client? [e.g. Should we show the exact GPS coordinates to the carer?]

### Definition of “implemented enough for me to re-review”
- [e.g. All states above render with real or mocked data; PR is open and tagged with BPC-xxx; Athaliah is tagged for UX review]
```

### Dennis receives by

- Confirming understanding on the ticket within the same thread
- Noting API gaps immediately (don’t invent backend) — if a field is missing, open a Dennis → Ian handoff
- Shipping a PR that references `BPC-xxx` and tags Athaliah for UX pass when visual

### Anti-patterns

- Screenshot-only handoff with no offline/error states
- Dennis redesigning core direction without a ticket conversation
- Waiting for perfect pixels before any technical spike if risk is high (spike can be separate ticket)
- Figma link that requires access request — Dennis should already have view permissions

---

## Dennis → Ian (API contract change request)

### When

UI requires data, commands, or guarantees FE cannot fake safely (idempotency, corrections, auth). This is a **contract change request** — Ian owns the API surface; Dennis describes what the frontend needs.

### Handoff packet

Copy and paste the block below into the Linear ticket as a comment, then fill in the bracketed parts.

```markdown
## BPC-xxx — API contract change request for Ian

### Change type
- [ ] New endpoint
- [ ] Modify existing endpoint
- [ ] Breaking change to existing contract

### User-visible behaviour needed
[What the carer/manager will see or do that requires this API]

### Proposed endpoint
- **Method:** `POST` / `GET` / `PATCH` / `DELETE`
- **Path:** `/api/v1/clock-in` (example)
- **Who calls it:** carer app / manager office / admin panel

### Request payload (draft fields)
```json
{
  "carerId": "string (UUID)",
  "shiftId": "string (UUID)",
  "timestamp": "ISO 8601",
  "location": {
    "latitude": 0.0,
    "longitude": 0.0
  },
  "clientEventId": "string (idempotency key)"
}
```

### Success response (draft)
- **Status:** `200 OK` or `201 Created`
- **Body:**
```json
{
  "clockInId": "string (UUID)",
  "recordedAt": "ISO 8601",
  "syncStatus": "synced" | "queued" | "conflict"
}
```

### Error cases FE must show
| HTTP status | Meaning | FE behaviour |
| --- | --- | --- |
| 400 | Invalid payload | Show field-level validation errors |
| 401 | Unauthorized | Redirect to login |
| 403 | Forbidden (e.g. outside shift window) | Show policy message from server |
| 409 | Duplicate clientEventId | Treat as success (idempotent) |
| 422 | Business rule violation (e.g. location too far) | Show rule-specific message |
| 500 | Server error | Show generic error toast + retry |

### Offline behaviour
- Will the carer app queue this request and replay when online? yes / no
- If yes, what field indicates the item is still queued vs synced?

### Idempotency / retry expectations
- **Idempotency key:** `clientEventId` (generated by FE, UUID v4)
- **What duplicate means:** If the same `clientEventId` is sent again, return the original response (200) instead of creating a duplicate

### Questions for Ian
- [e.g. Is `syncStatus` already part of the clock-in response, or does it need to be added?]
- [e.g. Should location be required or optional? What happens if GPS is off?]
- [e.g. Do we need a separate endpoint for clock-out, or can we reuse this with an `action` field?]
```

### Ian receives by

- Confirming or adjusting the contract on the ticket (comment with final agreed shape)
- Implementing with tests around retry/offline replay where relevant
- Calling out policy-configurable fields vs hard rules (so Jesse can clarify with client if needed)
- Commenting on the ticket when the endpoint is deployed to a testable environment

### Anti-patterns

- FE hardcoding fake success that teaches wrong trust
- BE shipping fields FE never agreed how to display for critical paths
- Side-channel-only agreement with no ticket/PR note
- Changing response shapes silently mid-sprint without a new contract change request

---

## Ian → Dennis (backend ready / contract changed)

### When

API exists, changed, or error semantics shifted.

### Handoff packet

Copy and paste the block below into the Linear ticket as a comment.

```markdown
## BPC-xxx — API ready for Dennis

### Endpoints / events
- `POST /api/v1/clock-in` — creates a clock-in record
- `GET /api/v1/shifts/{shiftId}/clock-ins` — lists clock-ins for a shift

### Auth / roles
- Bearer token required; carer role can only clock in for their own shifts

### Idempotency key behaviour
- Send `clientEventId` header; duplicate returns 200 with existing record

### Offline replay notes
- Queue on device; replay in order when connectivity returns; server deduplicates by `clientEventId`

### Breaking changes
- None in this release

### Example request/response
**Request:**
```json
POST /api/v1/clock-in
Authorization: Bearer <token>
Content-Type: application/json

{
  "shiftId": "abc-123",
  "timestamp": "2026-07-26T08:03:00Z",
  "location": { "latitude": -1.2921, "longitude": 36.8219 }
}
```

**Response (201):**
```json
{
  "id": "clock-456",
  "shiftId": "abc-123",
  "recordedAt": "2026-07-26T08:03:00Z",
  "syncStatus": "synced",
  "location": { "latitude": -1.2921, "longitude": 36.8219 }
}
```

### What FE should not assume
- `syncStatus` may be `queued` if the server is under load — always handle that state
- Timestamps are always in UTC; FE must convert to local time for display
```

### Anti-patterns

- Changing response shapes silently mid-sprint without ticket comment
- Documenting only in chat

---

## Jesse → team (client decision captured as Linear ticket)

### When

Jesse has received a decision, clarification, or policy answer from Best Pinnacle that the team needs to act on. This handoff turns a client conversation into an actionable, visible ticket that Athaliah, Dennis, Ian, or Gichogu can pick up.

### Handoff packet

Copy and paste the block below into a **new Linear ticket** (or as a comment on an existing `BPC-xxx` if the decision directly unblocks it). Jesse owns creating this ticket; the team owns reading and acting.

```markdown
## BPC-xxx — Client decision from Best Pinnacle (via Jesse)

### What was decided
[One or two sentences — the core answer]

### Original question / context
[What the team needed to know, e.g. “Should we allow clock-in without GPS?”]

### Options that were presented to the client
1. [Option A — plain language]
2. [Option B — plain language]
3. [Option C — plain language]

### Client’s choice and reasoning
- **Chosen:** Option [X]
- **Why (if shared):** [e.g. “They want to start with warn-only and revisit enforcement after 30 days of data”]

### What this means for the team
- **Athaliah (UX):** [e.g. Design the warning message; no need for a hard block screen yet]
- **Dennis (FE):** [e.g. Show a non-blocking warning toast when GPS is off; clock-in still proceeds]
- **Ian (BE):** [e.g. No enforcement rule needed yet; just log the missing location flag]
- **Gichogu (PM/environment):** [e.g. No config changes needed; note this decision in Notion for Sprint 2 review]

### Constraints or deadlines (if any)
- [e.g. Client wants to see the warning in the next build they test]
- [Only include if real; do not invent deadlines]

### Attachments / source
- [Link to email thread, meeting notes, or Notion page where decision was documented]
```

### Jesse’s responsibility

- Create the ticket in Linear with the `BPC-xxx` prefix
- Tag the relevant team members who need to act
- Keep the language plain — no engineering assumptions
- If the decision is urgent, also post a short Slack note pointing to the ticket (but the ticket is the source of truth)

### Team’s responsibility

- Read the ticket and acknowledge with a comment if it affects your work
- Do not re-litigate the decision in the ticket unless new information surfaces; if so, loop Jesse back in via a comment
- Use the ticket as the anchor for any resulting implementation work (new branches, PRs)

### Anti-patterns

- Client decision shared only in a Slack message that scrolls away
- Jesse implementing the decision directly in code or design without a ticket
- Team guessing the client’s intent because the decision wasn’t written down
- Decision ticket that lacks role-specific implications — everyone should know what they need to do (or that they need to do nothing)

---

## Athaliah ↔ Ian (rare but real)

### When

Experience depends on domain states only BE can guarantee (e.g. correction history display rules, exception categories).

### Practice

- Short joint note on ticket: which **states** are real in the system  
- Athaliah designs for real states; Ian does not invent UX chrome  
- Dennis still implements UI unless it’s schema-only work  

---

## Toward Jesse Ngari (needs client)

### When

- Location mode, grace periods, alert channels, timesheet period, tablet counts  
- Wording that implies a promise to Best Pinnacle  
- Scope change requested mid-build  

### Handoff packet

Copy and paste the block below into the Linear ticket as a comment.

```markdown
## Need from Best Pinnacle (via Jesse) — BPC-xxx

### Decision needed
…

### Options (plain language)
1. …
2. …
3. …

### Impact on carers / managers
…

### Impact if we guess wrong
…

### Reversible default if we must keep building
…

### Please confirm by / urgency
[only if real; don’t invent deadlines]
```

Jesse converts this into client-facing language (`client-comms-jesse.md`). Engineers do not freelance the client conversation.

---

## Toward Gichogu Macharia (environment / visibility)

### When

- Cannot access repo, Linear, environments, secrets process  
- PR/ticket linkage broken  
- Board doesn’t reflect reality; automation flaky  
- Need template/checklist help, not code ownership  

### Handoff packet

Copy and paste the block below into the Linear ticket as a comment.

```markdown
## Environment help — BPC-xxx or unblocked work

### What I can’t do right now
…

### What “fixed” looks like
…

### Systems involved
Linear / GitHub / local env / Claude kit / other

### Who is blocked
…
```

Gichogu unblocks rails; does not reassign craft methods as a condition of help.

---

## Multi-person example stories

### Story 1 — Offline pending UI

1. Athaliah improves current clock button states → handoff to Dennis using the Athaliah → Dennis template.  
2. Dennis finds no clear “queued” flag in API → opens a Dennis → Ian contract change request.  
3. Ian adds explicit sync state or documents existing field → Ian → Dennis handoff confirms the API is ready.  
4. PR opened; Athaliah reviews feel; Gichogu sees In Review.  
5. No client policy needed.

### Story 2 — Strict location enforcement request

1. Best Pinnacle asks “can we block clock-in offsite?” via Jesse.  
2. Jesse opens a “Need from Best Pinnacle” ticket.  
3. Team notes options record/warn/enforce; Jesse confirms with client.  
4. Jesse creates a **Jesse → team** ticket with the decision: “Start with warn-only; revisit enforcement in 30 days.”  
5. Ian implements rule configuration; Dennis implements UX for warn; Athaliah tunes messaging.  
6. Nobody implements enforce before confirmation.

### Story 3 — Correction audit gap found in review

1. Reviewer flags overwrite of original time.  
2. New bug ticket or fix-in-PR decision.  
3. Ian owns persistence; Dennis shows history if UI exposes it.  
4. Jesse informed only if client-facing claims about audit need adjusting.

### Story 4 — Client changes priority mid-sprint

1. Jesse receives a call: Best Pinnacle wants the timesheet export feature sooner.  
2. Jesse creates a **Jesse → team** ticket: “Client decision — prioritize timesheet export over correction history for this sprint.”  
3. Team reads the ticket, adjusts their own work without a top-down reassignment.  
4. Gichogu ensures the board reflects the new priority; no one is forced to drop in-progress work, but new pulls consider the updated direction.

---

## Handoff anti-patterns

- “@everyone” with no outcome  
- Design→code with no ticket  
- Client decision buried in a FE PR comment  
- PM rewriting CSS or SQL as “handoff”  
- Infinite handoff loops without a next slice owner  
- Assuming Stage 2 modules are in scope because a handoff mentioned “later platform”  
- Client decision shared only verbally or in a Slack thread — always land it in a Linear ticket

---

## Claude facilitation

When asked to “handoff this,” produce the **right packet template**, name the **next human**, and ensure **BPC-xxx** linkage language is present. Do not invent that Athaliah finished design or that Jesse confirmed policy.

Healthy handoffs keep speed **and** trust: the next person can act without re-deriving context, and the board still tells the truth.
