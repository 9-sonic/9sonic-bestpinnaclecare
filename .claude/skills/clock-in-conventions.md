# Skill: Clock-in conventions (product truths & coding guidance)

**Purpose:** Protect the **attendance truths** that make Best Pinnacle Care’s clock-in trustworthy — for Dennis Kabui, Ian Ndegwa, Athaliah Kisochi, and Claude when writing or reviewing code/UX.

**Use when:** Touching clock in/out, offline queue, live board, exceptions, corrections, timesheet inputs, location capture, PIN tablet paths, or any API that records attendance.

**Do not use to:** Invent a full platform backlog or silently close client policy decisions.

---

## Product truths to protect

These are non-negotiable design intents. Implementation details may vary; **violating the intent is a defect**.

### 1. Tap time is intentional and explainable

A carer’s clock-in or clock-out is a deliberate action. The system should be able to explain:

- Who acted (or which tablet identity path)  
- What action (in vs out)  
- When it was recorded (device/server time story must be coherent and documented)  
- Whether it was later corrected  

Do not invent events the carer did not trigger (e.g. speculative auto clock-out without an explicit product decision and ticket).

### 2. One official record despite retries

Networks fail. Buttons double-fire. Offline queues replay. The official attendance state must remain **honest**:

- Prefer idempotency keys / client-generated event ids / dedupe rules agreed on the ticket  
- A retry must not mean “two open shifts” or “two pays for one tap”  
- Logging may show multiple attempts; **business attendance** should not fork silently  

If unsure, stop and ticket the ambiguity — do not ship hopeful uniqueness.

### 3. Offline is a normal path

Domiciliary care includes poor signal. Conventions:

- Accept the tap locally when offline (FE)  
- Persist enough data to sync later without re-asking the carer to remember  
- Sync when connectivity returns without user heroics  
- Surface **pending / synced / failed** honestly in UI  
- BE must accept delayed events without treating them as fraud by default  

Airplane-mode testing is a first-class verification idea, not optional polish.

### 4. Audit over silent edit

Managers fix forgotten clock-outs and wrong taps. Conventions:

- **Original event remains**  
- Correction is a separate fact: who, when, why (reason field when product requires)  
- Downstream views (timesheets, exceptions) use the corrected operational value **while** history remains inspectable  
- Never `UPDATE` the original timestamp in place as if the past changed  

This supports payroll queries, disputes, and inspection narratives.

### 5. Location only at clock moments

- Capture location at clock-in and clock-out (and tablet site context if applicable)  
- **Do not** track continuous movement between visits  
- UI and privacy copy must not imply tracking  
- Storage should not accidentally become a breadcrumb trail from unrelated features  

UK GDPR fairness and staff trust depend on this boundary.

### 6. Office visibility from real events

Live board and exceptions should derive from attendance reality + schedule expectations the product actually has — not from manual spreadsheet re-entry as the system of record.

If schedule integration is incomplete in an early slice, be honest in UI and tickets about what is real vs placeholder. Do not fake live certainty.

### 7. Client policy is configuration, not ego

These are often **open** until Jesse confirms with Best Pinnacle:

| Policy | Example modes |
| --- | --- |
| Location checking | record-only / warn / strict enforce |
| Lateness | grace minutes; when “late” vs “missed” |
| Early leave | grace / flag rules |
| Alerts | in-app only vs SMS etc. |
| Timesheet period | weekly / fortnightly / 4-weekly |
| PIN tablets | whether needed; how many |

Code should prefer **configurable or clearly flagged defaults**, not hard-coded moral positions.

---

## Open stack / craft decisions (do not silently freeze in this skill)

The following may still be team-owned choices. Claude must **not** pretend the kit chose them:

- Exact mobile/web frameworks and styling approach  
- Exact offline storage engine on device  
- Exact API style (REST shape, RPC, etc.) beyond what the repo already uses  
- Exact database technology beyond repo reality  
- Map provider / location precision libraries  
- Realtime transport for live board (polling vs websocket/SSE) if not already decided in code  

**Guidance:** Follow the repository’s existing patterns. If greenfield, propose options with trade-offs on the ticket; let Dennis/Ian decide craft. Record durable decisions in Notion/decision notes when the team wants memory — not as Claude decrees.

---

## Coding guidance for Claude and builders

### Prefer smallest honest slice

- Vertical slice that proves a truth (e.g. offline queue → single BE record) beats a wide UI shell with fake data that trains wrong trust  
- If you must stub, label stubs clearly in code and PR  

### Naming and domain language

Prefer domain terms in code where practical:

- `clock_in` / `clock_out` / `attendance` / `correction` / `exception`  
- Avoid vague `updateThing()` for trust-critical mutations  

### Event mindset

Think in **events + state projection**:

- Events: attempted clock, accepted clock, sync ack, correction applied  
- Projections: currently on shift, open exception, approved hours  

This makes audit and idempotency easier than only mutable row rewrites.

### Frontend (Dennis) conventions

- Every clock action UI needs: in-progress, success, failure, offline-queued  
- Never show “Clocked in” as final if the system only queued locally — say pending if true  
- Disable or debounce double-taps thoughtfully without blocking legitimate later actions  
- Location permission denied: explicit path; don’t hang  
- Don’t embed unconfirmed legal/policy claims in microcopy  

### Backend (Ian) conventions

- Authenticate actor; authorise carer-vs-manager actions  
- Accept delayed offline timestamps with a clear model (device time + received time if both exist)  
- Idempotent accept of the same logical event  
- Corrections: append; retain original  
- Minimise PII exposure in logs; never log secrets  
- Make policy parameters data, not scattered magic numbers without comment/ticket  

### UX (Athaliah) conventions

- Design for one-handed, hurried, outdoor use  
- Offline and error are design states, not afterthoughts  
- Manager exception language should be calm and actionable  
- Corrections UX should not feel like “delete history”  

### Tests worth preferring on clock paths

- Double submit / retry  
- Offline then online replay  
- Correction preserves original  
- Permission/role checks for manager actions  
- Location payload absent vs present behaviour per current policy default  

Not every PR needs all tests; trust-breaking paths deserve extra care.

---

## PR self-review questions (clock-specific)

1. If this runs twice, what is the official attendance state?  
2. If the phone is offline for an hour, what does the carer see? What does the manager see?  
3. If a manager fixes a time, can we still prove the original tap?  
4. Did we store location outside a clock action?  
5. Did we hard-code a client policy still marked open?  
6. Would Jesse say this matches the story we tell Best Pinnacle?  

---

## Example: good vs bad implementations (conceptual)

### Good

- Client sends `event_id`; server returns existing attendance if `event_id` seen  
- FE shows “Saved on phone — will send when online”  
- Correction table references `original_event_id`  
- Location fields only on clock endpoints  

### Bad

- Server inserts a new open shift on every POST without dedupe  
- FE shows success green only on local press with no sync distinction  
- Manager edit overwrites `clocked_at` in place  
- Background geolocation “for safety” enabled by default  

---

## Interaction with sprints

- **Sprint 1:** Building and connecting paths — still must not ship known dual-record lies  
- **Sprint 2:** Testing and refining under real conditions — deepen offline, exceptions, polish  

Neither sprint is an excuse to defer product truths indefinitely without tickets and risk notes.

---

## Anti-patterns

- Continuous tracking “just for this demo”  
- Silent policy enforce mode  
- Fake live board numbers  
- Dropping audit for “speed”  
- Inventing Stage 2 care-plan work inside a clock PR  
- Claude declaring the offline store technology mandatory when the team hasn’t chosen  

---

## Quick reference card

| Truth | One-line test |
| --- | --- |
| Tap intentional | Can we say who did what when? |
| One record | Retry ≠ second reality |
| Offline normal | Works without signal |
| Audit | Original survives correction |
| Location limited | Only at clock |
| Policy open | Configurable or flagged |

Protect these truths and the team can iterate flexibly on everything else.
