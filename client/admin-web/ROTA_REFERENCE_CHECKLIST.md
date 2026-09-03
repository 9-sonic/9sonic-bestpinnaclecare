# Rota rebuild — checklist against `~/Downloads/rota-console.html`

Source of truth: the complete reference file (966 lines), not notes, not memory.
Every item below cites the exact reference mechanism to port and where it lands
in `RotaPage.jsx`. Check off only after it's built AND screenshot-verified
against the reference — not from reading the code.

---

## 1. Geometry — grid must use the reference's exact numbers

- [ ] `H0 = 6`, `H1 = 20` (reference line 567: `var H0=6,H1=20,HH=54`).
      **Current state: H1 is 22 in our file — deviation, revert to 20** unless we
      deliberately keep 22 to avoid clipping the 20:00–22:00 CO CHC shifts (real
      data has shifts past 20:00; reference's sample data doesn't). **Decision
      needed**: either extend the reference's window to 22, or confirm clipping
      is acceptable. Do not silently diverge — note it in a comment either way.
- [ ] `HH = 54` px/hour (reference line 567). Our `HOUR_PX` must equal 54.
- [ ] Hour line every hour + **dotted half-hour line** at `top + HH/2`
      (reference lines 619-622: `.hline` and `.hline.half`). We have hour lines;
      **half-hour dotted lines are missing** — add.
- [ ] Now-line: red 2px line at `(NOW_MIN/60 - H0)*HH`, only when `day===TODAY`
      (reference lines 138-139, 623). We have this — verify it only renders
      within the H0..H1 window (reference has no such clamp because NOW_MIN is
      always in range in the sample; ours must clamp since 826-line days exist).
- [ ] Weekend column shading: `.daycol.weekend { background: var(--surface-2) }`
      (line 134, applied `d>4` i.e. Sat/Sun). We added a `weekend` prop to
      `DayColumn` — **confirm it's actually passed from the week render loop**.
- [ ] Today column: `box-shadow: inset 0 0 0 1px var(--accent-soft)` (line 135)
      — a subtle inset outline, not a solid background fill. **We currently fill
      the whole column background — that's a deviation from the reference's
      subtle treatment.** Match: keep background transparent/weekend, add the
      inset outline instead.

## 2. Lane layout — `layout(list)`, reference lines 568-595

- [x] Sort by start then end.
- [x] Greedy lane assign: `endEff = max(e, s+25)`, first lane whose end `<= s`.
- [x] Widen rightward: each shift grows `span` into empty lanes until a real
      time-overlap in a lane blocks it (lines 582-593 exact logic).
- [ ] **Verify the "endEff" tiny-call minimum (25 min) is used in BOTH the lane
      assignment AND the widen-rightward blocking check** — reference uses it in
      both (`Math.max(s.e, s.s+25)` appears twice, lines 572 and 587). Confirm
      our `layoutDay` does the same in both places, not just one.

## 3. Shift card — `cardEl(sh, compact)`, reference lines 533-564

- [ ] Row 1 = `<code>` (SU initials) + `<icons>` + `<cnt>` (`n/req`), exact order.
- [ ] Icons, all four, only shown if applicable (line 541-545):
  - [ ] `↻` if `recurring` — **map to**: visit has `care_package_slot_id`. We
        have this.
  - [ ] `☾` if `live` — **N/A for timed cards**: live-ins never reach the
        timeline (they're in the band), so this icon never shows on a timed
        card in practice. Reference still checks it for completeness; skip.
  - [x] `◇` (training) — **OUT OF SCOPE, confirmed by the user 2026-09-04. Do
        not build.** No training-placement concept in the data model and none
        wanted.
  - [ ] `!` if `conflicts(sh).length` — **we do NOT show this yet.** Real
        mapping: a carer assigned to this visit who ALSO has another
        overlapping assignment that same day. We already compute this
        server-side conceptually (`Assignments::Validate.conflicting_visit`
        blocks it at assign-time), so a conflict showing here would mean HISTORIC
        data has an overlap the block didn't prevent (e.g. imported/seeded data,
        or a manager override). Compute client-side: for each assigned carer on
        a card, check if any OTHER visit that day has the same carer with an
        overlapping time window. **Build this — real signal, currently absent.**
- [ ] Not-compact body (lines 549-553):
  - [ ] Time line: `hh:mm–hh:mm` (live-in case N/A on cards). We have this.
  - [ ] Who line: carer names joined `", "` if assigned; else
        `"Needs N carer(s)"` if not cancelled, else `"Cancelled"`. We have this
        — **verify the exact cancelled-vs-unfilled branching matches** (ours
        currently always says carerLine based on assigned.length, check the
        cancelled case is distinct).
  - [ ] Trainee line — **N/A, no trainee concept.**
- [ ] Compact threshold: reference uses `dur(sh) < 40` **minutes** (line 626),
      not a pixel height. **We currently gate on rendered `height` in px — wrong
      basis, should be duration-based** to match exactly (a 39-min call is
      compact regardless of zoom level).
- [ ] `title` attribute: `"{SU name} · {time or live-in} · {run}"` (line 562).
      **We have no `run` field** — use what we have (client name + time + n/req)
      and drop the run segment, or add `run` per §9 below.
- [ ] Click without modifier → open (assign/detail). **Cmd/Ctrl/Shift-click →
      toggle multi-select** (lines 555-561) — **we don't support this; only the
      small dot-menu toggles selection.** Add modifier-click handling to the
      card's onClick.

## 4. Live-in band — reference lines 598-609, CSS 124-127

- [x] Sticky band above the grid, one cell per day.
- [x] Compact chips: code + first carer name / "unfilled".
- [ ] Reference shows `cardEl(s, true)` for the live-in chip — i.e. it reuses
      the SAME card component (row1 only: code+icons+count), not a bespoke
      chip. **Our `LiveInChip` is a separate, simplified component that drops
      the icons and count.** Either reuse `ShiftCard` in compact form for
      live-ins too, or explicitly add icons+count to `LiveInChip` to match.

## 5. Coverage strip — `dayStats`/`renderCover`, reference lines 499-530

**Not built. Missing entirely.** Implementation:
- [ ] `dayStats(day)`: for that day's visible, non-cancelled visits — 
      `req` = sum of `staff_required`, `fil` = sum of `min(assigned, staff_required)`,
      `unf` = sum of `staff_required - assigned` where short, `hrs` = sum of
      `(duration/60) * (staff_required - assigned)` for short visits (uncovered
      care-hours).
- [ ] Render one clickable cell per day ABOVE the grid (replacing/augmenting
      the current plain day-number header): day label/date, `"{fil}/{req}
      filled"`, `"{unf} gap(s)"` (only if unf>0, styled as warning), a 2-colour
      meter bar (filled % green, gap % orange) using `dayStats`.
- [ ] Click → jump to Day view for that date (reference line 524-526).

## 6. Left rail — reference lines 264-295

**Not built as a rail — partially built as a horizontal filter bar.**
- [x] Service-user filter (`fSU` → our client `<select>`).
- [x] Care-worker filter (`fStaff` → our carer `<select>`).
- [ ] **Shift-run filter** (`fRun`: Morning/Lunch/Tea/Bed call/Live-in) — no
      `run` concept in our data. See §9 (open question) before building this;
      do not invent categories the office hasn't confirmed.
- [x] Status chips (Unfilled/Part-filled/Filled/Completed/Cancelled) — built.
      **Standby is OUT OF SCOPE, confirmed by the user 2026-09-04 — do not add
      it as a chip, a lifecycle state, or anywhere else.**
- [ ] **Options toggles** — Show standby: **removed, N/A (standby out of
      scope)**. **Flag double-booking** (wire to the `!` conflict icon in §3 —
      toggle whether conflicts are computed/shown) — still to build. Travel
      time gaps (no travel-time concept in our scheduling — likely out of
      scope, flag as N/A).
- [ ] **Unfilled alert box** — big number + "N unfilled shifts this week — X h
      uncovered", clickable. Compute across the visible week the same way as
      `dayStats` but summed for all 7 days. Place at the top of the filter bar
      or as its own callout above the grid.
- [ ] **Week stats** (Shifts / Care hours / Live-in nights / Clashes) — small
      stat row. `Shifts` = count in view, `Care hours` = sum of
      `(duration/60)*staff_required` for non-cancelled, `Live-in nights` = count
      of live-in visits, `Clashes` = count of visits where any assigned carer
      has a conflict (§3's `!` check, deduped per visit).

Layout decision needed: reference puts all of this in a **216px left rail**.
Our page is currently full-width with a horizontal filter bar. **Two options,
need a call**: (a) keep horizontal, stack the alert/stats/toggles as additional
rows above the grid — less disruptive to the existing page chrome; (b) add a
real left rail matching the reference exactly — bigger layout change, touches
the page shell. Flagging for a decision, not deciding unilaterally.

## 7. Day view — reference lines 640-673

**Wrong shape entirely.** Reference's Day view is NOT a timeline — it's a
**grouped list**: header (day, "N shifts · fil of req covered · N gaps (Xh)"),
then shifts grouped under run-name headings (Live-in, Morning call, Day
support, Lunch call, Tea call, Bed call), each a row: time+duration, SU
name+address, carer names or "— unassigned —", conflict badge, count+Open
button.

**Current implementation is a single-day TIMELINE (ported from the week
grid)** — a different UI concept than the reference. Two paths:
- [ ] **Option A**: replace our Day view with the reference's grouped-list
      shape (requires the `run` field — see §9).
- [ ] **Option B**: keep our timeline Day view (it has real value — see actual
      shift times/overlaps visually, which the reference's Day view does NOT
      show) and treat it as an intentional improvement, not a gap. **This needs
      a decision — do not silently keep our version without flagging the
      divergence.**

## 8. Views we don't have at all

- [ ] **Unfilled queue view** (reference lines 687-725): grouped-by-day list of
      every unfilled/partial shift, each with up to-3 "Suggest" pills (carers
      free at that time, computed like `available(sh)` — exclude anyone with an
      overlapping assignment that day), Open + Advertise actions. "Advertise"
      has no real backend meaning yet (no shift-marketplace feature) — would
      need to be a no-op/toast or a real feature decision.
- [ ] **Staff view** (reference lines 728-772): table of carers × this week's
      hours (with a contracted-hours progress bar) × live-in night count × one
      column per day showing that carer's shifts, red-flagged on conflict. We
      have a separate Employees page with some overlap but not this exact
      week-load table. Decide: fold into Employees, or build as a Rota sub-view
      matching the reference.

## 9. Open questions — do not invent, confirm first

- **`run` field** (Morning call / Lunch call / Tea call / Bed call / Live-in /
  Day support): the reference categorizes every shift by a "run". Our
  `CarePackageSlot`/`Visit` model has no equivalent field. Needed for: the
  Shift-run filter, the reference's Day view grouping, and the card's `title`
  attribute. **Either add a real `run` column (backend change, needs a
  decision on whether it's derived from time-of-day or explicitly set), or drop
  run-based features from the port.**
- **Standby status**: **OUT OF SCOPE — confirmed by the user 2026-09-04. Do not
  build.**
- **Training placements**: **OUT OF SCOPE — confirmed by the user 2026-09-04.
  Do not build.**
- **Notes carer/manager visibility split**: **OUT OF SCOPE — confirmed by the
  user 2026-09-04. `VisitNote` stays as-is, no migration, no split.**
- **"Advertise unfilled"**: reference is a toast-only mock. Real feature would
  need a shift-marketplace/broadcast mechanism — out of scope unless requested.
- **Conflict (`!`) flag**: real and buildable now from existing data (no schema
  change) — highest-value missing piece, should be built regardless of the
  open questions above.

## 10. Actions / drawer / bulk / toast — smaller gaps

- [ ] Card click should support Cmd/Ctrl/Shift multi-select (§3).
- [ ] Toast **Undo** — confirm our toast supports an undo action; reference uses
      it on every assign/unassign/cancel/bulk action.
- [ ] Detail drawer: add an explicit conflict warning box when the selected
      carer has an overlap (reference lines 839-846), and a "Free at this time"
      suggestion list (reference lines 860-867, reuse the `available()` logic
      from §8).
- [ ] Detail drawer: audit/history list — **we may already have visit event
      history server-side (Events::Record)** — check before assuming it needs
      building; if it exists, wire it in; if not, that's a real backend gap to
      flag, not fake data to invent.
- [x] Detail drawer: notes — **OUT OF SCOPE, confirmed 2026-09-04.** Keep
      `VisitNote` exactly as it is; do not split carer-visible/manager-only.

---

## Priority read (not a schedule — just what's cheap/high-value vs needs a decision)

**Buildable now, no open questions:**
§1 geometry fixes, §2 lane-layout double-check, §3 conflict icon + compact
threshold + modifier-click, §4 live-in card reuse, §5 coverage strip, §6
unfilled-alert + week-stats (drop run-filter/standby-toggle/travel-toggle
pieces that need decisions).

**Needs a decision before building:**
§6 layout (rail vs horizontal), §7 Day view shape, §9 all open questions,
§10 audit/notes (check existing models first, don't assume gap).
