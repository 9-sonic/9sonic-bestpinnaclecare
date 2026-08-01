# Skill: Pull requests and review

**Purpose:** Keep code changes **small enough to review**, **linked to Linear**, and **safe for attendance trust** — for authors (Dennis Kabui, Ian Ndegwa), reviewers, and Gichogu Macharia’s PM glance.

**Use when:** Starting a branch, opening a PR, reviewing, deciding whether to split work mid-discovery, or checking whether the board matches GitHub reality.

---

## Branch naming

Canonical patterns:

- `feat/BES-xxx-short-desc` — new behaviour
- `fix/BES-xxx-short-desc` — bug fix

Other accepted prefixes (use when the work doesn’t fit feat/fix):

| Type | Use |
| --- | --- |
| `chore/` | Tooling, deps, non-user-facing cleanup |
| `docs/` | Documentation only |
| `refactor/` | Behaviour-preserving structure change (still needs care on clock paths) |

**Examples**

- `feat/BES-118-offline-pending-indicator`  
- `feat/BES-123-carer-clock-in`  
- `fix/BES-141-duplicate-clock-in`  
- `fix/BES-150-manager-correction-audit`  
- `chore/BES-160-ci-placeholder`  

**Rules of thumb**

- One primary ticket per branch when possible  
- Short slug; English words; no client secrets  
- Prefer short-lived branches; reopen from default if heavily stale  

If work starts before a ticket exists, **create the ticket first** (or immediately) so the branch name can include `BES-xxx`. Silent branches undermine Jesse/Gichogu visibility.

---

## Author checklist (before requesting review)

### Intent and linkage

- [ ] Linear `BES-xxx` exists and matches the PR outcome  
- [ ] PR title contains `BES-xxx`  
- [ ] PR description explains **why**, not only **what**  
- [ ] Linear status moved to In Progress / In Review as appropriate  
- [ ] Related design/decision links included when relevant  

### Product truths (clock-in specific)

- [ ] Offline path considered (or explicitly N/A with reason)  
- [ ] Retries / double-submit cannot create dishonest duplicate records  
- [ ] Manager corrections do not destroy original events (if touched)  
- [ ] Location only at clock moments (if touched)  
- [ ] No silent policy invention (grace, enforce location, etc.)  

### Quality

- [ ] Change is scoped; unrelated refactors removed or split  
- [ ] How to test is written (including offline / failure if relevant)  
- [ ] UI: screenshots or short notes for Athaliah/Dennis-facing changes  
- [ ] API: contract notes for the other side (Dennis ↔ Ian)  
- [ ] Secrets, real staff data, and prod keys absent  

### Honesty

- [ ] Open questions listed  
- [ ] Follow-up work ticketed rather than hidden  
- [ ] Known risks stated (especially payroll/audit/privacy)

---

## PR description template

Copy-paste this into every PR description and fill each section.

```markdown
## Summary
BES-XXX — [one paragraph outcome]

## Why
[User/system problem]

## What changed
- …

## Checklist
- [ ] Linked to BES-XXX
- [ ] Offline tested (or N/A with reason)
- [ ] Audit log preserved (original events not overwritten)
- [ ] No duplicate clock records (idempotency verified)
- [ ] Design review (if UI changes — tag Athaliah)

## Product truths touched
- Offline: …
- One record / idempotency: …
- Audit/corrections: …
- Location: …
- None of the above: …

## How to test
1. …
2. … (include offline / retry if relevant)

## Screenshots / recordings
[if UI]

## API / contract notes
[if FE/BE boundary]

## Open questions / follow-ups
- … (link BES- if already created)

## Risk notes
- …
```

---

## Reviewer checklist

### Always (every reviewer)

- [ ] Does the PR match the ticket outcome (not a drive-by rewrite)?  
- [ ] Is the slice reviewable in one sitting? If not, request split.  
- [ ] Are tests/repro steps credible?  
- [ ] Any trust-breaking attendance issues?  

### Attendance trust checklist (offline, audit, location)

- [ ] **Offline handling:** Queued actions replay correctly without data loss or duplication; offline state transitions are clear to the carer.  
- [ ] **Audit trail:** Original clock events are preserved; manager corrections append history rather than overwriting; every change is attributable to an actor.  
- [ ] **Location capture:** Location is recorded only at clock-in/clock-out moments; no continuous background tracking; location data is not exposed beyond what the product requires.  

### Ian Ndegwa — Backend & Idempotency

- [ ] **Idempotency:** Repeated submissions with the same client-generated event id produce exactly one attendance record; retry and offline replay do not create duplicates.  
- [ ] Identity of carer/actor clear on events  
- [ ] Timestamps and clock event lifecycle make sense  
- [ ] Dedupe/idempotency story for retries and offline replay is explicit and testable  
- [ ] Correction path appends history if present  
- [ ] AuthZ: carers vs managers vs system jobs  
- [ ] No accidental continuous location storage  
- [ ] API contracts are clear for Dennis’s consumption  

### Dennis Kabui — Frontend & UI States

- [ ] **UI states:** Loading, offline queued, error, success, and empty states are all handled and visible to the carer.  
- [ ] Copy doesn’t claim unconfirmed client policy  
- [ ] Accessible enough for real phone use (tap targets, contrast, clarity)  
- [ ] Doesn’t fight Athaliah’s current direction without a note  
- [ ] Handles API failure without fake “clocked in” confidence  
- [ ] Offline indicators are clear and match the actual queue state  

### Athaliah Kisochi — Design Fidelity

- [ ] **Design fidelity:** Visual/UX direction matches the current design iteration; any deviation is intentional and noted.  
- [ ] Empty and exception views are intentional and consistent with the overall design language  
- [ ] Spacing, typography, and component usage follow the established patterns  
- [ ] Interaction flows (transitions, feedback) feel coherent with the rest of the app  
- [ ] If the PR introduces a new pattern, it is documented or discussed with the team  

### Review comment style

Prefer:

- “If the carer double-taps here, do we create two opens?”  
- “This overwrites `original_clocked_at` — product truth prefers append.”  

Avoid:

- Drive-by style mandates unrelated to the PR  
- Vague “clean this up” without pointing to risk or readability  
- Blocking on pure preference when product truths are safe — note as non-blocking  

---

## PM glance checklist (Gichogu Macharia)

You are **not** re-implementing the review. You check **visibility and risk surface**:

- [ ] PR references `BES-xxx`  
- [ ] Linear status roughly matches (In Review when PR open)  
- [ ] Description has a test plan or clear verification path  
- [ ] Open questions aren’t client-policy landmines left unnamed  
- [ ] If stuck > reasonable time, is there a blocker comment or linked issue?  
- [ ] Merge doesn’t leave the board lying (status update / automation)

If something looks invisible or trust-risky, **nudge on the ticket/PR** — don’t silently rewrite the solution.

---

## Small PRs when discovering

Discovery mid-implementation is expected. Procedure:

1. **Stabilise** what you already understand into a safe, mergeable slice.  
2. **Open follow-up `BES-xxx`** for the new surface area.  
3. **Do not** grow one PR into “while I was here” redesign + infra + feature.  
4. If the discovery is a **trust break** on mainline behaviour, prefer fix before merge or explicit block.  
5. Say in the PR: “Split out BES-YYY for …”

### When to split immediately

- FE and BE changes with no agreed contract yet → contract PR or spike note first if needed  
- Design exploration mixed with production path rewrites  
- Dependency upgrades bundled with feature work  
- Multiple unrelated bugs  

### When a slightly larger PR is OK

- A thin vertical that cannot be tested otherwise  
- Atomic fix where split would leave main broken  
- Document the reason in the PR body  

---

## Merge expectations

Merge when:

- Review concerns on product truths are addressed or explicitly accepted with residual risk noted  
- CI (when present) is green or failures understood  
- Ticket acceptance for **this slice** is met  
- No unresolved “we invented client policy” 

After merge:

- Linear → Done (automation or human)  
- Mention follow-ups still open  
- Tell Athaliah if UI landed and needs visual QA  
- Tell Jesse only if client-visible behaviour or promise surface changed in a way he should know

---

## Examples

### Good PR summary

> BES-141 — Treat repeated clock-in submissions with the same client-generated event id as one attendance open. Offline replay verified; manager board still shows single on-shift state.

### Weak PR summary

> fixes  
> (no ticket, no test plan, 40 files of mixed concerns)

### Good review comment

> Offline replay hits this endpoint twice in the notes — can we add a test that the second call doesn’t open a second attendance?

### Weak review comment

> I would have used a different framework. Rewrite everything.

---

## Anti-patterns

- PRs without tickets for real product work  
- “WIP forever” branches with no description  
- Force-pushing over review threads without addressing them  
- Approving trust-breaking paths because “we’ll fix in Sprint 2” with no ticket  
- PM dictating code structure in review  
- Client commitments made in PR comments instead of Jesse’s channel  
- Mega-PR used to hide incomplete acceptance  

---

## Claude’s role in PR work

Help authors draft descriptions and test plans; help reviewers enumerate product-truth risks; help Gichogu phrase visibility nudges.  

Do **not**: invent a merge schedule; invent reviewers’ decisions; expand PR scope into a new backlog; claim CI exists if it doesn’t.

Good PRs make Sprint 1/2 iteration safe. They are how the team ships under uncertainty without losing trust.
