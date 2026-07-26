# Skill: Issue handling (Linear + GitHub)

**Purpose:** Make work **visible, reviewable, and honest** using Linear tickets `BPC-xxx` as task truth together with GitHub branches/PRs — without turning tickets into fake certainty or day plans.

**Use when:** Creating work, refining a fuzzy idea into a ticket, splitting scope, linking PRs, updating status, or helping non-devs (Jesse, Gichogu, Athaliah) write good issues.

---

## Tool roles (do not blur)

| Tool | Source of truth for | Not for |
| --- | --- | --- |
| **Linear** | Intent, status, discussion, sprint cycle membership | Long prose specs as the only home of decisions |
| **GitHub** | Code, review, merge history | Replacing Linear as the team board |
| **Notion** | Durable decisions, specs, client-confirmed policy notes | Daily task board / “what’s in progress” |

---

## Linear field mappings (exact)

Use these concrete field formats and values when creating or refining a ticket. They ensure every ticket is scannable, filterable, and automatable.

### Title format

```
[Area] Outcome-oriented description
```

- **Area** is a short domain tag: `Clock`, `Attendance`, `Location`, `Manager`, `Carer`, `Sync`, `Audit`, `Tooling`, `Design`, `Client request`, `Bug`
- **Description** states the user-facing result, not the technology.

**Examples:**
- `[Clock] Carer cannot clock in offline`
- `[Attendance] Prevent duplicate open shifts on retry`
- `[Location] Confirm warn vs block at clock-in`
- `[Client request] Add carer notes field to clock-out`
- `[Bug] Exception queue missing forgotten clock-out`

### Description template (detailed)

For bugs and feature work that need precise reproduction and acceptance, use this template. Copy-paste into the Linear description field and fill in each section.

```markdown
## Context
[Why this exists now; link to client conversation, design decision, or discovery]

## Current behavior
[What happens today — be specific: screens, error messages, data state]

## Expected behavior
[What should happen after the fix/feature — user-visible outcome]

## Steps to reproduce
1. [Step 1 — e.g., "Log in as carer on mobile, turn on airplane mode"]
2. [Step 2 — e.g., "Tap clock-in button"]
3. [Step 3 — e.g., "Observe error message or missing feedback"]
4. [Expected vs actual at each step if helpful]

## Acceptance criteria
- [ ] [Criterion 1 — testable, e.g., "Offline clock-in shows pending sync badge"]
- [ ] [Criterion 2 — e.g., "Badge disappears after successful sync"]
- [ ] [Criterion 3 — e.g., "No duplicate attendance record created"]
- [ ] [Edge cases considered: double-tap, app kill, network restore mid-sync]

## Product truths
- [ ] Offline behaviour considered
- [ ] One official record / retries
- [ ] Audit / corrections
- [ ] Location only at clock
- [ ] N/A — explain

## Open questions
- …

## Non-goals
- …

## Links
- Design: …
- Related: BPC-…
- Client confirmation: …
```

### Label suggestions

Apply these labels to make the board filterable and to trigger any automation (if configured). Use multiple labels when appropriate.

| Label | Meaning | When to apply |
|-------|---------|---------------|
| `bug` | Defect — something broken | Unexpected behaviour, regression, trust-impacting error |
| `frontend` | UI/UX implementation | Changes to screens, components, user flows |
| `backend` | API, database, records | Server-side logic, data integrity, endpoints |
| `design` | Visual/interaction design | Athaliah's work, mockups, flows, design handoff |
| `needs-design` | Requires design input before build | Feature needs Athaliah's direction; not ready for implementation |
| `client-request` | Originated from Best Pinnacle | Anything Jesse brings from client conversations |
| `tooling` | Environment, automation, kits | Gichogu's domain; CI/CD, Linear/GitHub setup |
| `question` | Needs discussion before implementation | Blocked on decision; use to flag in standup |

### Automation rules (Linear ↔ GitHub)

- **Auto-link PR via branch name:** When a branch is named `feat/BPC-123-short-slug`, `fix/BPC-123-short-slug`, `chore/BPC-123-short-slug`, or `docs/BPC-123-short-slug`, Linear will automatically link the PR if the integration is active. The ticket ID (`BPC-123`) is the key.
- **Status transitions:** If your workspace has automations, configure:
  - Branch creation → move ticket to **In Progress**
  - PR opened → move to **In Review**
  - PR merged → move to **Done**
- **Manual fallback:** If automation is off or fails, paste the PR link into the Linear ticket's description or Links section, and include `BPC-xxx` in the PR title and body. Manual links in both places beat perfect automation.

---

## Step-by-step: Creating a Linear ticket from an idea

This guide turns a raw idea into a concrete, trackable `BPC-xxx` ticket. Anyone on the team can follow it — Jesse, Gichogu, Athaliah, Dennis, Ian — and Claude can assist at any step.

### When to create a ticket
- The idea is clear enough that someone could start work on it within the current sprint.
- It’s not a vague wish; you can describe an outcome and at least one acceptance criterion.
- If the idea is still fuzzy, first use the **Refining a vague request** checklist below, then create the ticket once the shape is agreed.

### Step 1: Open Linear and start a new issue
- In your Linear workspace, click the **`+`** button (top bar) or press **`C`** to create a new issue.
- Select the appropriate **Team** (e.g., “Best Pinnacle Care”) and **Project** if your workspace uses projects. If unsure, leave project empty; the sprint assignment will handle grouping.

### Step 2: Write the title
- Use the **`[Area] Outcome-oriented description`** format from the field mappings above.
- Examples:
  - `[Clock] Carer sees pending sync after offline clock-in`
  - `[Attendance] Prevent duplicate attendance on clock-in retry`
  - `[Client request] Confirm location warning vs block`
- Avoid vague titles like `Fix stuff` or `Backend`.

### Step 3: Fill the description using a template
- Choose the template that fits the work (see **Templates** section below). For bugs and detailed features, use the **Detailed issue template** (with Context, Current behavior, Expected behavior, Steps to reproduce, Acceptance criteria).
- At minimum, include:
  - **Context** – why this exists now
  - **Outcome / acceptance** – how we’ll know it’s done for this slice
  - **Open questions** – anything still uncertain
  - **Links** – related tickets, designs, Notion pages
- If you’re unsure which template to use, start with **Template A: Standard work item**.

### Step 4: Set the assignee
- In the **Assignee** field, choose the person who will own the work. This can be:
  - Jesse (client requests, communication)
  - Gichogu (environment, tooling)
  - Athaliah (design improvements)
  - Dennis (frontend)
  - Ian (backend)
- If ownership isn’t decided yet, leave it unassigned. The ticket will be picked up during sprint planning or by whoever is free. **Do not** assign to someone without their agreement.

### Step 5: Assign a sprint
- Use the **Sprint** field to place the ticket in **Sprint 1** (build) or **Sprint 2** (test & refine). If it’s not for the current cycle, leave it in the **Backlog**.
- We do **not** use day-level deadlines or sub-sprint milestones. Sprint assignment is coarse and flexible.

### Step 6: Add labels
- Apply labels from the **Label suggestions** table above. Common combinations:
  - `bug` + `frontend` for a UI defect
  - `client-request` + `needs-design` for a new feature awaiting Athaliah's direction
  - `backend` + `bug` for data integrity issues
- You can apply multiple labels.

### Step 7: Set priority (optional)
- If your Linear setup uses priority levels (e.g., Urgent, High, Medium, Low), set one based on impact. Default to Medium unless it’s trust-breaking or blocking others.

### Step 8: Save the ticket
- Click **Create Issue**. Linear will assign a unique ID like `BPC-142`. This ID is now the canonical reference for all related work.

### Step 9: Link to a GitHub branch (when work starts)
- When you begin coding, create a branch with the naming convention:
  - `feat/BPC-142-short-slug` (for features)
  - `fix/BPC-142-short-slug` (for bugs)
  - `chore/BPC-142-short-slug` (for tooling)
  - `docs/BPC-142-short-slug` (for documentation)
- In your pull request (PR):
  - Include `BPC-142` in the PR title.
  - In the PR body, add a link back to the Linear ticket: `https://linear.app/.../BPC-142`.
- In the Linear ticket:
  - Paste the PR link into the description or the **Links** section.
  - If your Linear-GitHub integration is active, the PR will appear automatically (see Automation rules). If not, manual linking is fine — **manual links in both places beat perfect automation**.

### Example walkthrough
**Idea:** “Carer sees pending sync after offline clock-in”

1. **Title:** `[Clock] Carer sees pending sync after offline clock-in`
2. **Description (Detailed template):**
   - Context: Offline clock-in already stores locally; carer needs visibility to avoid confusion.
   - Current behavior: Carer taps clock-in while offline; no feedback that the action is queued.
   - Expected behavior: Offline clock-in shows a “pending sync” badge on the clock button; badge disappears after successful sync; no duplicate attendance created.
   - Steps to reproduce: 1) Log in as carer on mobile. 2) Enable airplane mode. 3) Tap clock-in. 4) Observe no pending indicator. 5) Disable airplane mode; observe sync but no visual confirmation.
   - Acceptance criteria:
     - [ ] Offline clock-in shows a “pending sync” badge on the clock button.
     - [ ] Badge disappears after successful sync.
     - [ ] No duplicate attendance record created.
     - [ ] Badge persists across app restarts until sync.
   - Product truths: Offline behaviour considered, One official record / retries, Audit / corrections.
   - Open questions: What exact UI element? Does it need a retry button?
   - Links: Design mockup (Figma link), related BPC-140.
3. **Assignee:** Dennis (frontend)
4. **Sprint:** Sprint 1
5. **Labels:** `frontend`, `design`
6. **Priority:** Medium
7. **Save** → ticket `BPC-143` created.
8. **Later, when coding:** branch `feat/BPC-143-pending-sync-badge`, PR title `BPC-143 Add pending sync badge to clock button`.

---

## Refining a vague request into an actionable ticket

When someone brings a fuzzy idea (“the clock-in is broken”, “we need offline mode”, “client wants better reports”), use this checklist to turn it into a concrete `BPC-xxx` ticket. Anyone can facilitate this — Jesse, Gichogu, Athaliah, Dennis, Ian — and Claude can help draft.

### Refinement checklist

Work through these questions in order. Stop when you have enough clarity to write a ticket; you don’t need perfect answers to everything.

- [ ] **1. Identify the user and moment.** Who experiences this? (Carer, manager, system, client) When does it happen? (Clock-in, clock-out, viewing history, correction)
- [ ] **2. Describe the current behaviour.** What actually happens today? Be specific: “The app shows a spinner for 30 seconds then a generic error” not “it doesn’t work”.
- [ ] **3. Describe the expected behaviour.** What should happen instead? “The app stores the clock-in locally and shows a pending sync badge” — outcome, not implementation.
- [ ] **4. List steps to reproduce (if bug).** Write numbered steps anyone can follow. Include environment: device, network state, account type.
- [ ] **5. Draft acceptance criteria.** What specific, testable conditions must be true for this to be “done”? Use checkboxes.
- [ ] **6. Check product truths.** Which of our standing constraints apply? (Offline, retries/idempotency, audit trail, location only at clock, one official record)
- [ ] **7. Identify open questions.** What don’t we know yet? List them explicitly — don’t hide uncertainty.
- [ ] **8. Determine if client confirmation is needed.** If the request came from Best Pinnacle, has Jesse confirmed the exact ask? If not, add `client-request` label and note “Awaiting client confirmation” in the description.
- [ ] **9. Decide if design input is needed.** Does this need Athaliah’s direction before implementation? If yes, add `needs-design` label and link to any existing mockups or conversations.
- [ ] **10. Assign a rough area tag.** Choose from: `Clock`, `Attendance`, `Location`, `Manager`, `Carer`, `Sync`, `Audit`, `Tooling`, `Design`, `Client request`, `Bug`. This becomes the `[Area]` in the title.
- [ ] **11. Write the title** using the `[Area] Outcome-oriented description` format.
- [ ] **12. Choose the right template.** For bugs and detailed features, use the **Detailed issue template** (Context, Current behavior, Expected behavior, Steps to reproduce, Acceptance criteria). For standard work, use Template A. For client requests, use Template C.
- [ ] **13. Fill in the template** with the answers from steps 1–10. Leave unknowns as open questions.
- [ ] **14. Set labels, sprint, and assignee** following the field mappings and step-by-step guide above.
- [ ] **15. Review with the team** if the ticket touches multiple domains or has high risk. A quick comment in the team channel with the ticket link is enough.

### Example: Vague → Actionable

**Vague request:** “Offline clock-in is broken”

**After refinement:**
- **User:** Carer on mobile
- **Current behaviour:** Tapping clock-in while offline shows a generic error toast “Network error” and no record is saved.
- **Expected behaviour:** Clock-in is stored locally and queued for sync; carer sees a “pending sync” indicator.
- **Steps to reproduce:** 1) Log in as carer. 2) Enable airplane mode. 3) Tap clock-in. 4) Observe error toast. 5) Disable airplane mode; no attendance created.
- **Acceptance criteria:**
  - [ ] Offline clock-in stores locally and shows pending badge.
  - [ ] Badge clears after successful sync.
  - [ ] No duplicate attendance on retry.
- **Product truths:** Offline, idempotency, audit.
- **Open questions:** Should we allow clock-out while offline too? (Separate ticket if yes)
- **Client confirmation:** Not needed (existing product truth).
- **Design input:** Yes — Athaliah to provide badge UI and sync feedback states.
- **Title:** `[Clock] Offline clock-in stores locally with pending sync indicator`
- **Labels:** `frontend`, `needs-design`, `bug`
- **Template:** Detailed issue template

---

## Ticket refinement checklist (pre-implementation)

Before a ticket moves to **In Progress**, verify these points. The author and the assignee (if different) should both review.

- [ ] **Title** uses `[Area] Outcome-oriented description` format and is scannable.
- [ ] **Description** contains:
  - [ ] Context (why now)
  - [ ] Current behavior (if bug) or current state (if feature)
  - [ ] Expected behavior / outcome
  - [ ] Steps to reproduce (if bug)
  - [ ] Acceptance criteria (specific, testable)
  - [ ] Product truths considered (offline, retries, audit, location, etc.)
  - [ ] Open questions listed (none hidden in chat)
  - [ ] Non-goals stated if scope could creep
- [ ] **Assignee** is clear and has agreed to own it.
- [ ] **Sprint** is set (Sprint 1, Sprint 2, or Backlog) — no day-level deadlines.
- [ ] **Labels** are appropriate and help board filtering (see Label suggestions table).
- [ ] **Links** are present: related tickets, design files, Notion decisions, client confirmation (if applicable).
- [ ] **Client confirmation** is obtained for any request from Best Pinnacle (Jesse handles this; ticket should note confirmation status).
- [ ] **No fake certainty** — the ticket does not assume unconfirmed policy, implementation details, or exact timelines.
- [ ] **Size check** — the work can reasonably be completed within the sprint. If it’s too large, split into smaller tickets before starting.

### Before marking Done (additional checks)
- [ ] For code work: PR is merged, and the branch is deleted.
- [ ] Acceptance criteria are demonstrably met (tested manually or via automated tests).
- [ ] Linear ticket links to the merged PR.
- [ ] Any new discoveries that emerged during implementation are captured as new tickets (cross-linked).
- [ ] Client-facing changes have been communicated to Jesse if needed.

---

## What a good `BPC-xxx` contains

Every real work item should be understandable by someone who was not in the conversation.

### Required spirit (fields may map to Linear template)

1. **Title** — `[Area] Outcome-oriented description`, scannable  
2. **Context** — why this exists now  
3. **Current behavior** (if bug) or **Current state** (if feature)  
4. **Expected behavior / Outcome** — how we’ll know it’s done **for this slice**  
5. **Steps to reproduce** (if bug)  
6. **Acceptance criteria** — specific, testable conditions  
7. **Constraints** — product truths, dependencies, environments  
8. **Open questions** — explicit; never hidden in chat only  
9. **Links** — design, PR, related tickets, Notion decision if any  

### Optional but high value

- **User** — carer vs manager vs system  
- **Risk** — trust / payroll / privacy if wrong  
- **Non-goals** — what this ticket will not solve  
- **Test notes** — offline airplane mode, double-tap, correction path  

### Title patterns that work

- `[Clock] Carer sees pending sync after offline clock-in`  
- `[Attendance] Prevent duplicate attendance on clock-in retry`  
- `[Manager] Correction stores original clock event`  
- `[Client request] Confirm location warning vs block`  
- `[Bug] Exception queue missing forgotten clock-out`  

### Title patterns to avoid

- `Fix stuff`  
- `Sprint 1 tasks`  
- `Backend` / `Frontend` with no outcome  
- `Phase 1 complete platform`

---

## Status flow (flexible labels)

Use the team’s Linear workflow. Conceptual flow:

```text
Idea / Todo → In Progress → In Review → Done
                 ↑               │
                 └──── blocked ──┘ (use label/status the team prefers)
```

### Honest status rules

| Status | Means |
| --- | --- |
| Todo / Backlog | Not actively worked; still real intent |
| In Progress | Someone is actively doing it; prefer linked branch |
| In Review | PR open or design awaiting structured feedback |
| Done | Merged (for code) or explicitly accepted (for non-code) **and** outcome met |
| Cancelled | Intentionally not doing; reason noted |

**Do not** mark Done because “we talked about it.”  
**Do not** leave In Progress for a week with no PR, no comment, and no blocker note.

Gichogu can help if automation should move status on PR open/merge; humans still own honesty when automation is off.

---

## GitHub linkage conventions

- Branch: `feat/BPC-123-short-slug` (or `fix/`, `chore/`, `docs/`)  
- PR title: include `BPC-123`  
- PR body: summary, test plan, open questions, product truths touched  
- Linear: paste PR link; GitHub: paste ticket id  

If a PR cannot link automatically, **manual links in both places** beat perfect automation.

---

## Templates

### Detailed issue template (bug / feature with reproduction)

Use this for bugs and features that need precise current/expected behavior and reproduction steps. Copy-paste into Linear description.

```markdown
## Context
[Why this exists now; link to client conversation, design decision, or discovery]

## Current behavior
[What happens today — be specific: screens, error messages, data state]

## Expected behavior
[What should happen after the fix/feature — user-visible outcome]

## Steps to reproduce
1. [Step 1]
2. [Step 2]
3. [Step 3]
4. [Expected vs actual at each step if helpful]

## Acceptance criteria
- [ ] [Criterion 1 — testable]
- [ ] [Criterion 2]
- [ ] [Criterion 3]
- [ ] [Edge cases considered: double-tap, app kill, network restore mid-sync]

## Product truths
- [ ] Offline behaviour considered
- [ ] One official record / retries
- [ ] Audit / corrections
- [ ] Location only at clock
- [ ] N/A — explain

## Open questions
- …

## Non-goals
- …

## Links
- Design: …
- Related: BPC-…
- Client confirmation: …
```

### A. Standard work item

```markdown
## Outcome
[What becomes true for carer / manager / system]

## Context
[Why now; link conversation if needed]

## Acceptance (this slice)
- [ ] …
- [ ] …

## Product truths
- [ ] Offline behaviour considered
- [ ] One official record / retries
- [ ] Audit / corrections
- [ ] Location only at clock
- [ ] N/A — explain

## Open questions
- …

## Non-goals
- …

## Links
- Design: …
- PR: …
- Related: BPC-…
```

### B. Bug (lightweight)

```markdown
## Expected
## Actual
## Repro steps
## Environment
## Severity (trust / workflow / polish)
## Suspected area (FE / BE / both)
## PR / commit if known
```

### C. Client request (Jesse)

```markdown
## Who asked (Best Pinnacle)
## Request in plain language
## Why it matters to them
## Our current understanding
## Questions to confirm before build
## Client confirmation status
```

### D. Design task (Athaliah)

```markdown
## User moment
## Problem in current experience
## Deliverable for handoff (flows/states/artifacts)
## Ready for implementation? (yes/no)
## Needs FE / BE contract change?
```

### E. Environment / tooling (Gichogu)

```markdown
## Problem people hit
## Desired environment outcome
## Systems (Linear, GitHub, Claude kit, secrets, envs)
## How we’ll know it’s fixed
## Who is unblocked after
```

---

## Examples (good vs weak)

### Example 1 — Good

**Title:** `[Attendance] Prevent double clock-in creating two open attendances`  

**Outcome:** Retrying clock-in after a timeout does not create two concurrent open shifts for the same carer.  

**Acceptance:** Simulated double submit and offline replay both result in a single open attendance; audit/log shows dedupe or idempotent accept.  

**Open questions:** Client-visible message when second tap is ignored?  

### Example 1 — Weak

**Title:** `Idempotency`  
**Body:** “Handle it.”  
No user impact, no acceptance, no owner path.

### Example 2 — Good (client)

**Title:** `[Client request] Location check: warn vs block at clock-in`  
**Body:** Captures Best Pinnacle question, lists three modes (record / warn / enforce), marks confirmation pending, does not assign implementation until Jesse confirms.

### Example 2 — Weak

**Title:** `GPS mandatory`  
**Body:** Implements enforce mode in code with no client confirmation.

### Example 3 — Good (design → FE)

**Title:** `[Clock] Clarify offline queued state on carer clock button`  
**Body:** States Athaliah’s direction, lists states, links artifact, acceptance is visual + copy for pending sync, notes no API change if queue already exists.

---

## Splitting and discovering work

When implementation reveals more work:

1. **Finish a safe slice** in the current ticket/PR if possible.  
2. **Open a new `BPC-xxx`** for the discovery — do not silently inflate the original forever.  
3. Cross-link tickets.  
4. If discovery is trust-breaking, escalate visibility (comment + tag Ian/Dennis; Jesse if client impact).

Discovery is expected. Invisible scope growth is not.

---

## Who creates issues?

| Situation | Often created by |
| --- | --- |
| Client ask | Jesse (or Gichogu helping capture) |
| Design improvement ready for build | Athaliah (+ Dennis refine acceptance) |
| API/record work | Ian |
| UI behaviour | Dennis |
| Tooling/board/automation | Gichogu |
| Review finding | Reviewer or author |

Anyone may draft; **owners refine**. Claude should draft in the team’s voice and leave assignment to humans unless asked to suggest an owner.

---

## Avoid list

- Issues that are only a technology name with no outcome  
- “Do all of Sprint 1” mega-tickets  
- Day-by-day checklists inside Linear as fake project plans  
- Duplicate tracking only in Notion  
- Tickets marked Done without PR/merge for code work  
- Closing open client questions inside implementation tickets without Jesse  
- Personal task dumps unrelated to shared outcomes  
- Security-sensitive data (secrets, real staff PII dumps) pasted into tickets  

---

## Claude facilitation prompts (internal)

When helping write an issue, Claude should ask only what is missing:

1. Who is the user of the outcome?  
2. What is the smallest done?  
3. Which product truths apply?  
4. What is still open?  
5. Is this client policy?  

Then produce a filled template — not a roadmap.

---

## Definition of a healthy board (for Gichogu’s glance)

- In Progress items have a human and preferably a PR  
- Client requests are labeled/recognisable  
- Blocked work says what would unblock it  
- No ticket claims certainty about unconfirmed Best Pinnacle policy  
- Sprint 1 / Sprint 2 cycles used coarsely, not as micro-deadlines for every hour  

Issues exist so the team can move under uncertainty **together** — not so the board becomes a second manager.
