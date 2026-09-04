# Rota rebuild — checklist against `~/Downloads/rota-console.html`

Source of truth: the complete reference file (966 lines), not notes, not memory.
Every item below cites the exact reference mechanism to port and where it lands
in `RotaPage.jsx`. Check off only after it's built AND screenshot-verified
against the reference — not from reading the code.

**Status 2026-09-04:** `RotaPage.jsx` was rewritten to the reference shape. The
owner's brief was "implement this design as is — the only change is that the
side rail's options go at the top instead". Everything below is now built or
explicitly ruled out; the remaining unchecked boxes are the three things the
backend has no concept of.

---

## 1. Geometry — grid must use the reference's exact numbers

- [x] `H0 = 6` matches. **`H1 = 22`, deliberately, not 20** — documented
      deviation in code (RotaPage.jsx comment above `H1`): real CO CHC evening
      calls run 20:00–22:00 and the reference's own sample data never tests
      past 19:00, so H1=20 would silently clip real shifts. Flagging this as a
      known, intentional divergence, not an oversight.
- [x] `HH = 54` — done, verified.
- [x] Hour line every hour + dotted half-hour line at `top + HH/2` — done.
- [x] Now-line, today only, clamped to the H0..H1 window (our data can have a
      day where "now" falls outside 06–22, which the reference's fixed sample
      never has to handle) — done.
- [x] Weekend column shading — `weekend` prop wired from the week render loop.
- [x] Today column — subtle inset outline (`boxShadow: inset 0 0 0 1px
      var(--d-primary-soft)`), not a solid fill — done.

## 2. Lane layout — `layout(list)`, reference lines 568-595

- [x] Sort by start then end.
- [x] Greedy lane assign: `endEff = max(e, s+25)`, first lane whose end `<= s`.
- [x] Widen rightward: each shift grows `span` into empty lanes until a real
      time-overlap in a lane blocks it (lines 582-593 exact logic).
- [x] The 25-min `endEff` minimum is used in both lane assignment and the
      widen-rightward blocking check (matches reference lines 572 and 587).

## 3. Shift card — `cardEl(sh, compact)`, reference lines 533-564

- [x] Row 1 = code (initials) + icons + `n/req`, exact order.
- [x] `↻` if `care_package_slot_id` present — done, and now backed by a real
      API field (was silently broken before; see backend commit).
- [x] `☾` — N/A for timed cards (live-ins live in the band only); not built,
      correctly so.
- [x] `◇` (training) — confirmed out of scope, not built.
- [x] `!` conflict flag — built (`conflictsOn`), real overlap detection on
      absolute timestamps against the FULL loaded week (not the filtered view,
      or a clash would vanish when you filter to one client). Same carer, two
      visits, overlapping time, not cancelled.
- [x] Not-compact body: time line + who line (`carer names` / `Needs N
      carer(s)` / `Cancelled`) — done, matches the three-way branch.
- [x] Trainee line — N/A, correctly not built.
- [x] Compact threshold fixed to duration (`< 40 minutes`), not pixel height —
      matches the reference exactly now.
- [x] `title` attribute now includes `run` (from the new backend field).
- [x] Cmd/Ctrl/Shift-click toggles multi-select on the card itself. The old
      per-card dot menu is gone — the reference has no such control, and every
      action it held now lives in the drawer or the bulk bar.

## 4. Live-in band — reference lines 598-609, CSS 124-127

- [x] Sticky band above the grid, one cell per day, compact chips (code +
      carer/"Unfilled"). Kept as a distinct lightweight component rather than
      reusing the full `ShiftCard` in compact mode — same information density,
      simpler markup for a component that never needs the full card's
      position/lane math (live-ins are never laid into a timeline). It does
      carry the `↻` and `!` marks, as the reference's compact card does.

## 5. Coverage strip — `dayStats`, reference lines 499-530

- [x] Built and wired into the week-view day headers: `{fil}/{req} filled`,
      `{unf} gap(s)` when short, a two-colour meter bar. Click jumps to Day view
      for that date. Verified by screenshot against real seeded data.

## 6. Left rail — reference lines 264-295

**Built as a horizontal bar + row, not a 216px side rail** — a deliberate
layout choice (the page is full-width; a side rail would be a bigger shell
change) — everything the rail contains is present:
- [x] Service-user filter, care-worker filter.
- [x] **Shift-run filter**, wired to the new backend `run` field.
      do not invent categories the office hasn't confirmed.
- [x] Status chips (Unfilled/Part-filled/Filled/Completed/Cancelled) — built.
      **Standby is OUT OF SCOPE, confirmed by the user 2026-09-04 — do not add
      it as a chip, a lifecycle state, or anywhere else.**
- [x] **Options toggles** — "Flag double-booking" is built as a real toggle and
      drives the `!` card flag, the day-view "Double-booked" badge, the drawer's
      warning box and the Clashes stat. "Show standby" and "Travel time gaps"
      are NOT drawn: there is no standby state and no travel data to compute a
      gap from. Drawing a dead toggle would be worse than omitting it.
- [x] **Unfilled alert box** — built: big number + "N unfilled slots this
      week — Xh uncovered", clicking it opens the Unfilled queue view. Turns
      green and reads "every slot this week is covered" at zero. Verified
      against real data (144 unfilled / 446.6h for w/c 31 Aug 2026).
- [x] **Week stats** — built: Visits / Care hours / Live-in nights / Clashes,
      Clashes highlighted when non-zero, plus the draft/published state. All
      respect the filters. Verified by screenshot.

Layout: **decided by the owner 2026-09-04 — horizontal, at the top, no side
rail.** The command bar is one card holding three rows: (1) Today + week nav +
the four view tabs + the page actions, (2) the unfilled alert + week stats +
the publish state, (3) the client/carer/run filters + status chips + the
double-booking toggle. This is no longer an open question.

## 7. Day view — reference lines 640-673

- [x] **Built to the reference's shape (Option A).** The Day view is a grouped
      list, not a timeline: a header (`Friday, 4 September 2026` · "28 visits ·
      0 of 37 slots covered · 37 gaps (125.8h)"), then the day's visits under
      their run heading (Live-in, Morning call, Day support, Lunch call, Tea
      call, Bed call, Other calls), each row time + duration, client name +
      address, carer names or "— unassigned —", a "Double-booked" badge when
      the carer clashes, and n/req + Open.
- The single-day TIMELINE we had is gone, per the owner's "as is" instruction.
  The week grid still gives the visual time/overlap read.

## 8. The two missing views — both now built

- [x] **Unfilled queue** (reference lines 687-725): every gap in the week
      grouped by day, soonest first, each row carrying up to three "Free now"
      carers computed exactly like the reference's `available()` (active, not
      already on the visit, no overlapping assignment), plus Open and
      Advertise. Clicking a suggestion assigns for real.
      *Known, matches the reference:* the three suggestions are simply the
      first three free carers, so on a rota where nobody is assigned yet they
      are the same three names on every row. Ranking them (e.g. by who is
      furthest under contracted hours) would be an improvement on the
      reference, not a port of it — flagging rather than deciding.
- [x] **Advertise is REAL, not a toast.** The reference mocks it; we already had
      `POST /admin/cover_offers/broadcast` (Cover::Broadcast — offers the visit
      to every eligible carer, first-come, idempotent) with no caller. It is
      now wired to the drawer's Advertise, the queue row's Advertise, the
      bulk bar, and "Advertise unfilled" in the command bar.
- [x] **Staff view** (reference lines 728-772): carers x the week — hours
      against contracted hours with a progress bar (red when over), live-in
      night count, and one column per day of that carer's visits, red-flagged
      on a clash. Built as a rota sub-view, matching the reference, rather than
      folded into the Employees page.

## 9. Open questions — do not invent, confirm first

- **`run` field** — **RESOLVED.** `Visit#run` is a computed (not stored) label
  derived from UK start time + duration, shipped in `VisitSerializer`. No
  migration, no schema decision locked in, and it stays correct if a visit is
  retimed. It now drives the run filter, the Day view grouping and the card
  title. Verified against the reference's own 12 example shifts.
- **Standby status**: **OUT OF SCOPE — confirmed by the user 2026-09-04. Do not
  build.**
- **Training placements**: **OUT OF SCOPE — confirmed by the user 2026-09-04.
  Do not build.**
- **Notes carer/manager visibility split**: **OUT OF SCOPE — confirmed by the
  user 2026-09-04. `VisitNote` stays as-is, no migration, no split.**
- **"Advertise unfilled"** — **RESOLVED.** The broadcast mechanism already
  existed server-side (`Cover::Broadcast`) and simply had no UI. Now wired; see
  §8. Eligibility (any active carer without a clash) is still the smallest
  reversible default and is NOT signed off by Best Pinnacle — Jesse to confirm.
- **Conflict (`!`) flag** — **RESOLVED and built.** Computed from existing data
  on absolute timestamps (never minute-of-day, which would hide an overnight
  clash), against the FULL loaded week rather than the filtered view — a clash
  must not disappear because you filtered to one client. Shows on timed cards,
  on live-in chips, as a Day-view badge, in the drawer, and as the Clashes
  stat. Verified by injecting a deliberate double-booking.

## 10. Actions / drawer / bulk / toast

- [x] Card click supports Cmd/Ctrl/Shift multi-select, feeding the bulk bar.
- [x] Detail drawer is now the reference's right-hand slide-in (it replaced the
      centred assign/detail modals): client + day/time header, address / run /
      repeats / carers-needed / status, one staffing SELECT per carer required
      (assign / reassign / withdraw all from the one control), the conflict
      warning box, "Free at this time" suggestion pills, the rules that apply,
      an audited Change-time + notes form, the care record, the history, and
      the footer actions.
- [x] Detail drawer history — the server-side trail existed
      (`GET /admin/visits/:id/events`, reschedules + cancels + every assignment
      change, actor resolved) and had no caller. Now wired, newest first, with
      human labels. Nothing invented.
- [x] Detail drawer: notes — **OUT OF SCOPE, confirmed 2026-09-04.** Keep
      `VisitNote` exactly as it is; no carer/manager visibility split. The one
      `visit.notes` field is editable in the Change-time form, which is what
      the backend already permits (and audits, with a required reason).
- [ ] Toast **Undo** — NOT built. The reference's undo rolls back mock state in
      the browser; ours would need compensating API calls, and the destructive
      actions (cancel, delete, bulk cancel) instead go through a confirm dialog
      that requires a reason for the audit trail. That is the better trade for
      an audited record — flagging the divergence rather than hiding it.

---

## What is left

Only the three things with no backend concept, all confirmed out of scope with
the owner on 2026-09-04 — **do not build without a fresh decision**:

- **Standby** — no such visit state.
- **Training placements** — no trainee/shadowing concept on an assignment.
- **Travel-time gaps** — no travel or journey data.

Plus two deliberate divergences recorded above: **toast undo** (§10) and the
**unranked cover suggestions** (§8).

## Verification (2026-09-04)

Driven in a browser against a fixture dumped from the real dev database (105
visits, 18 carers, 15 clients for the current week) — the office login could
not be used, so the API layer was stubbed with that fixture and the harness
removed afterwards. Confirmed by clicking: all four views render; the run
filter, status chips, double-booking toggle and Clear all narrow the grid; week
nav and Today move the range; a coverage-strip day opens that day's list;
the drawer opens with staffing slots, free-carer pills, care record and
history; assigning from a pill runs and toasts; Ctrl-click multi-select raises
the bulk bar with the right actions; the Add-visit modal opens and closes; the
page themes in light and dark. A deliberately injected double-booking produced
the `!` flag on both timed cards and live-in chips, the Day-view badge, the
drawer warning and a Clashes count of 4.

The two newly wired endpoints are now covered by request specs
(`spec/requests/api/v1/admin/visits_spec.rb`), asserting the exact response
shape the console reads rather than just the status code:

- `GET /admin/visits/:id/events` — visit-level and assignment-level events merge
  into one timeline, oldest first, actor resolved, `payload.reason` and
  `payload.employee_name` present; empty array when there is no history.
- `POST /admin/cover_offers/broadcast` — offers go to every eligible carer,
  `offered` (the number the toast shows) matches the eligible set, a carer
  booked on an overlapping visit is excluded, re-advertising is idempotent, and
  a fully staffed visit is refused with `visit_already_filled`.

Both paths were also confirmed to route from a running server (401, not 404).

**Still NOT verified:** the mutations clicked through a live signed-in browser
session — no office login was available to this run. Every mutation calls an
endpoint that this page already used, and the two new ones are now spec-covered,
so the residual risk is the wiring between click and call.

**Resolved while here — local test DB:** this machine's `bestpinnacle_test`
had been seeded by hand (4 admins, 18 employees, 14 clients, 4,990 visits).
Nothing in `rails_helper` or `spec/support` loads seeds, so it was a one-off.
It made 10 request specs fail locally — count-based and first-row assertions
colliding with the seed rows (reports, attendance exports, staff cover / sync /
office-contacts). CI was always green: `.github/workflows/ci.yml` runs
`bin/rails db:test:prepare` then `bundle exec rspec` with no seed step.

Purged with `bin/rails db:test:prepare`; the full suite is now **532 examples,
0 failures**, matching CI. **Do not seed the test database** — a spec that needs
data should create it through a factory, so each example owns its own state.
(The broadcast specs above still assert against the eligible *set* rather than a
hard-coded count, so they hold either way.)
