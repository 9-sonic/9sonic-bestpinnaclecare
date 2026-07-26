# Skill: Uncertain work

**Purpose:** Help anyone on the Best Pinnacle Care clock-in team act when the next move is unclear — without inventing a backlog, a day plan, or a false method.

**Use when:** A new idea appears; Best Pinnacle asks for something via Jesse; design can be better but path is fuzzy; a bug appears in review; two options both seem valid; a client request arrives without a ticket.

**Do not use to:** Fill Sprint 1/2 with speculative tasks “just in case.”

---

## Core stance

Uncertainty is normal in iterative delivery. The correct response is:

1. **Name the outcome** people care about.  
2. **Separate known product truths** from **open decisions**.  
3. **Pick the smallest learning or delivery step**.  
4. **Make it visible** in Linear (`BPC-xxx`) and, when code exists, a PR.  
5. **Leave craft method to the specialist** unless they ask for options.

Claude and helpers **align minds**; they do not seize the wheel.

---

## Conventions that keep work visible and reversible

### Branch naming

When code work starts, create a branch from `main` using this pattern:

```
feature/bpc-xxx-short-desc
```

Examples:
- `feature/bpc-142-offline-queue-indicator`
- `feature/bpc-155-manager-exception-report`
- `feature/bpc-167-fix-duplicate-clockin`

If the work is a bug fix, use `fix/bpc-xxx-short-desc`. If it’s a spike or exploration, use `spike/bpc-xxx-short-desc`. The `bpc-xxx` must match the Linear ticket number. This keeps every branch traceable to a single outcome, visible to Gichogu, Jesse, and the whole team without reading the diff.

### PR title and description

Title: `[BPC-xxx] Short description of outcome`  
Description: Link the Linear ticket, summarise what changed and why, list any open questions or follow-up tickets. If the PR closes the ticket, include `Closes BPC-xxx` so Linear updates automatically.

---

## Scenario 1 — New client ask arrives via Jesse Ngari

**When:** Best Pinnacle requests a behaviour, report, or rule through Jesse (call, email, chat). No Linear ticket exists yet. The team must turn a verbal ask into visible, trackable work without over-committing.

### Step-by-step actions

1. **Capture the request in the client’s words.** Jesse owns the relationship; others do not freelance client promises. Write down exactly what was asked, who asked it, and the business reason if stated.  
2. **Translate to internal outcome language** without adding features. Example: “Managers want to see who forgot to clock out” becomes “Provide a manager-facing exception list of missing clock-out events.”  
3. **Flag policy vs product mechanism.** Policy example: “warn if away from site” vs “block clock-in.” Mechanism example: how the frontend shows the warning; how the backend stores the event.  
4. **Create a new Linear issue** using the template below. Assign it a `BPC-xxx` number immediately — do not wait for a perfect ticket.  
5. **Tag the owner.** If the work is primarily frontend, tag Dennis; if backend, tag Ian; if design exploration, tag Athaliah; if environment/visibility, tag Gichogu. Jesse remains the client point of contact.  
6. **Propose the smallest reversible step.** This could be a spike to confirm data availability, a mock API response, or a single-screen prototype. The step must be small enough to discard if the client changes direction.  
7. **Draft confirmation questions** Jesse can send to Best Pinnacle (see `client-comms-jesse.md`) when something is ambiguous.  
8. **If code work is likely,** note the branch naming convention (`feature/bpc-xxx-short-desc`) in the ticket so the implementer can create the branch immediately.  
9. **Link any existing PR** if someone already started exploratory work. If no PR exists, the ticket alone is the source of truth until code appears.  
10. **Stop** once the issue is clear enough for an owner to take a first slice. Do not generate a 10-ticket epic unless humans ask to split.

### Template — Client-origin ticket (with acceptance criteria)

```markdown
Title: [Client request] Manager exception list for missing clock-outs

Description:
- Who asked (Best Pinnacle): Jane (Operations Manager)
- Their words / summary: “I need to know which carers didn’t clock out yesterday so payroll isn’t delayed.”
- Business why: Payroll accuracy; reduce manual chasing.
- Urgency / timing if stated: Wants it before next pay run (2 weeks).
- Our understanding of outcome: A screen in the office dashboard showing carers with a clock-in but no matching clock-out for a selected date range, with an option to export.
- Ambiguities to confirm with client: Should the list include carers who never clocked in? Should managers be able to manually mark a shift as “completed” from this screen?
- Related product truths: One official record, audit trail, office visibility.
- Status of client confirmation: not yet

Acceptance criteria (what must be true for the client to consider this done):
- [ ] Manager can select a date range and see a list of carers with missing clock-outs.
- [ ] Each row shows carer name, last clock-in time, and expected shift end (if known).
- [ ] Manager can export the list as CSV.
- [ ] The list does not alter any clock-in/out records — it is read-only.

Open questions (for Jesse to clarify with Best Pinnacle):
- Is “expected shift end” available in the current roster data?
- Should the list auto-refresh or be manually refreshed?

Suggested first implementation step (smallest reversible step):
- Spike: Ian queries the database to confirm we can reliably identify missing clock-outs for the last 7 days. Result documented in a comment on this ticket. No UI yet.

Not doing now:
- Automatic notifications to managers.
- Integration with payroll software.
```

### Anti-patterns

- Engineers answering Best Pinnacle directly with commitments  
- Implementing the strictest possible rule “to be safe” without confirmation  
- Losing the request in chat with no Linear record  
- Claude inventing go-live dates or Stage 2 scope as if agreed  
- Waiting for a “perfect” ticket before creating the BPC-xxx — draft it immediately and refine

---

## Scenario 2 — Athaliah proposes a design change mid-sprint

**When:** Athaliah identifies a user experience problem in the current clock-in flow (e.g., offline state unclear, empty states missing, heavy interaction). The change needs to be captured, scoped, and handed off without derailing the sprint.

### Step-by-step actions

1. **Start from the current experience.** Athaliah describes the problem with the existing flow — not a greenfield redesign.  
2. **Name the user moment.** Example: “Carer clocking in while offline” or “Manager viewing an empty exception list.”  
3. **Describe all states,** not only the happy path: loading, empty, offline queued, sync failed, permission denied, location unavailable.  
4. **Create a Linear issue** using the design improvement template below. Assign it a `BPC-xxx` number.  
5. **Tag the owner.** Athaliah owns the design direction; Dennis owns frontend implementation. If backend changes are needed, tag Ian. If client copy or policy is involved, tag Jesse.  
6. **Propose the smallest reversible step.** This might be a Figma mockup of one state, a static HTML prototype, or a feature-flagged UI change behind a toggle. The step must be small enough to revert if user feedback is negative.  
7. **Handoff packet** (see `cross-role-handoffs.md`): goal, flows, states, what is exploratory vs ready to build. Attach Figma links or screenshots to the ticket.  
8. **If code work starts,** Dennis creates a branch `feature/bpc-xxx-short-desc` and opens a draft PR early to share progress. Link the PR in the Linear ticket.  
9. **Keep design exploration notes** in the ticket comments or a linked Notion page, not in a separate silo.  
10. **Ticket for implementation** when ready for code; do not block all engineering until every pixel is perfect.

### Template — Design improvement brief

```markdown
Title: Improve offline clock-in indicator for carer home screen

User moment:
- Carer opens the app in a low-connectivity area and needs to know whether their clock-in will be queued or has failed.

Problem with current experience:
- The app shows a generic spinner with no distinction between “sending” and “queued for later.” Carers sometimes close the app, losing the clock-in attempt.

Proposed direction (not final pixels if still moving):
- Replace spinner with a progress step indicator: “Sending…” → “Queued (will send when online)” → “Clock-in recorded at [time].”
- Use a persistent banner when offline: “You’re offline. Clock-ins will be saved and sent automatically.”

States to cover:
- Default: normal online clock-in flow.
- Loading: “Sending…” with cancel option.
- Offline queued: clock-in saved locally, banner shown, time of attempted clock-in displayed.
- Sync failed: after retry, show “Could not send. Tap to retry or contact manager.”
- Success: confirmation with timestamp, banner dismissed.
- Empty: N/A for this flow.

Open:
- Needs client copy? yes — Jesse to confirm wording with Best Pinnacle.
- Needs API change? no — existing offline queue endpoint is sufficient.
- Needs policy confirmation? no.

Acceptance criteria (what we’ll verify before closing):
- [ ] Carer sees distinct “Sending…” and “Queued” states during offline clock-in.
- [ ] Queued clock-in is stored locally and sent when connectivity returns.
- [ ] Banner is dismissible but reappears if still offline on next clock-in attempt.
- [ ] No duplicate clock-in records are created.

Ready for Dennis?
- [ ] Yes — linked Figma mockups for each state attached.
- [ ] Not yet — still exploring animation timing.

Suggested first implementation step (smallest reversible step):
- Dennis implements the offline banner only (no progress indicator) behind a feature flag `offlineBanner`. Athaliah reviews on staging. If feedback is positive, proceed to progress indicator; if not, toggle off and iterate.
```

### Anti-patterns

- Big-bang redesign tickets with no states  
- Design handoff as screenshots only, no offline/error behaviour  
- Frontend inventing visual system changes without Athaliah when design-owned  
- Blocking all engineering until every pixel is perfect

---

## Scenario 3 — Bug found during review

**When:** A reviewer (any team member) discovers unexpected behaviour in a PR. The bug must be assessed, documented, and resolved without silently merging or derailing the sprint.

### Step-by-step actions

1. **Reproduce facts:** expected vs actual behaviour; environment (staging, local); ticket/PR link. Write a clear reproduction script.  
2. **Assess severity** (informal, not a bureaucracy):  
   - **Trust-breaking** — duplicate records, lost offline event, silent overwrite, location leaking beyond clock → stop-ship energy, fix or feature-flag before merge.  
   - **Workflow-breaking** — can’t complete clock-in/out in a common path.  
   - **Polish** — copy, spacing, non-blocking UX.  
3. **Decide fix-now vs follow-up ticket:**  
   - Same PR if small and in scope.  
   - New `BPC-xxx` if larger or orthogonal.  
4. **Create a Linear issue** using the bug template below if a follow-up ticket is needed. Assign it a `BPC-xxx` number.  
5. **Tag the owner.** Dennis for frontend bugs, Ian for backend, Athaliah if design behaviour is wrong, Jesse if client policy is involved.  
6. **Propose the smallest reversible step.** For trust-breaking bugs, the step might be a revert of the offending commit or a feature flag to disable the broken path. For others, a targeted fix with a test.  
7. **Link the PR** in the Linear ticket. If the fix is in the same PR, comment on the PR with the bug details and tag the author.  
8. **Record residual risk** on the PR and Linear so Gichogu and Jesse can see risk without reading the diff.  
9. **Do not expand the PR** into unrelated refactors while “fixing.”  
10. **After fix,** verify acceptance criteria and close the bug ticket or mark the PR comment resolved.

### Template — Bug / review finding

```markdown
Title: [Bug] Duplicate clock-in record when double-tapping during offline sync

Found in: PR #42 / BPC-155

Expected:
- A single clock-in record is created even if the carer taps the button multiple times while offline.

Actual:
- Two identical clock-in records appear after sync, both with the same timestamp.

Impact:
- trust (duplicate records violate one-official-record truth)

Repro:
1. Enable airplane mode on device.
2. Open app, tap “Clock In” three times quickly.
3. Disable airplane mode and wait for sync.
4. Check office dashboard — two or three records for the same carer at the same time.

Product truth at risk:
- One official record / idempotency

Acceptance criteria for fix:
- [ ] Only one clock-in record is created regardless of tap frequency while offline.
- [ ] Idempotency key is used to deduplicate on the backend.
- [ ] Existing duplicate records from this bug are flagged for manual review (not auto-deleted).

Proposal:
- Fix in this PR: no — too large for current scope.
- Follow-up ticket: BPC-168 (created from this template).

Suggested first implementation step (smallest reversible step):
- Ian adds an idempotency key to the clock-in endpoint and writes a test that sends duplicate requests. Dennis updates the frontend to generate and persist the key during offline queueing. Feature-flagged behind `idempotencyFix` until validated on staging.

Owner: Ian (backend), Dennis (frontend coordination)
```

### Anti-patterns

- “We’ll fix later” on trust-breaking issues with no ticket  
- Expanding the PR into unrelated refactors while “fixing”  
- Blame-focused review comments; prefer behaviour and tests/repro  
- Closing review by force-merge without recording residual risk

---

## Scenario A — New idea, method unknown (general)

### Signals

- “We should make offline clearer.”  
- “Managers need to see forgotten clock-outs.”  
- “What if the carer double-taps?”  
- No ticket yet; no agreed implementation.

### Steps

1. **Restate the idea as an outcome** (user or system result), not a tech stack choice.  
2. **Check product truths** (`clock-in-conventions`, `product-clock-in`): does this protect or threaten one-record, offline, audit, location-at-clock?  
3. **List unknowns** in two buckets:  
   - *Team craft* (how we build)  
   - *Client policy* (needs Jesse ↔ Best Pinnacle)  
4. **Propose 1–3 next options** with trade-offs; do not rank as mandates.  
5. **Open or refine a Linear issue** with outcome + open questions + acceptance criteria.  
6. **Stop** once the issue is clear enough for an owner to take a first slice. Do not generate a 10-ticket epic unless humans ask to split.

### Template — Linear issue from a fuzzy idea

```markdown
Title: [Outcome in plain language]

Context:
- Where the idea came from: [conversation / observation / review]
- Who is affected: [carer / manager / payroll / all]

Desired outcome:
- [One or two sentences — what good looks like]

Product truths involved:
- [ ] Offline
- [ ] One official record / idempotency
- [ ] Audit / corrections
- [ ] Location at clock only
- [ ] Office visibility

Knowns:
- …

Open questions (craft):
- …

Open questions (client / Jesse):
- …

Acceptance criteria (what we’ll check before closing):
- [ ] …
- [ ] …
- [ ] …

Suggested first slice (optional, not a plan):
- [Smallest thing that teaches us or delivers partial value]

Not doing now:
- [Explicit non-goals so scope doesn’t silently grow]
```

### Anti-patterns

- Turning one sentence into a multi-week roadmap  
- Choosing libraries before the outcome is clear  
- Assigning Dennis/Ian a method they didn’t accept  
- Mixing client-policy unknowns into “just implement something strict”

---

## Cross-cutting decision aid

Ask in order:

1. **Is this client policy?** → Jesse path.  
2. **Is this experience shape?** → Athaliah + Dennis.  
3. **Is this record/trust/API?** → Ian (+ Dennis for contract).  
4. **Is this environment/visibility?** → Gichogu.  
5. **Is this still a fuzzy idea?** → Outcome ticket first, no code mandate.

---

## What “done enough to proceed” means under uncertainty

You do **not** need a perfect plan. You need:

- A named outcome  
- Visible ownership or clear next owner  
- Listed open questions  
- Acceptance criteria (even if draft)  
- A first slice small enough to reverse  
- No silent violation of product truths  

If those exist, stop planning and let craft begin.

---

## Claude checklist (copy when facilitating)

- [ ] I did not invent a day plan or multi-ticket epic unasked  
- [ ] I used real names (Jesse, Gichogu, Athaliah, Dennis, Ian) where roles matter  
- [ ] I separated client policy from implementation  
- [ ] I offered a Linear template or filled one, including acceptance criteria  
- [ ] I included branch naming convention (`feature/bpc-xxx-short-desc`) when code work is likely  
- [ ] I protected offline / one-record / audit / location-at-clock  
- [ ] I left method choice with the specialist  
- [ ] I pointed to PR visibility if code will follow  

Uncertainty is not failure. Invisible, over-promised, or trust-breaking work is.
