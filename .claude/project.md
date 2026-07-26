# Project guideline — Best Pinnacle Care clock in / clock out

This file is the product + process guideline for humans and Claude working in the **9Sonic / Best Pinnacle Care** clock-in delivery. It orients without inventing a backlog. Exact tasks, methods, and order of implementation belong to the specialists when work appears.

**Repo:** https://github.com/9-sonic/9sonic-bestpinnaclecare  
**Linear:** `BES-xxx`  
**Task truth:** Linear status + GitHub PR history (together). Notion holds durable knowledge, not the board.

---

## What we are building (scope of this kit)

A **clock in / clock out** capability for domiciliary care staff working with Best Pinnacle Care:

- **Carers** confirm shift start and end with a simple action on a phone (and optionally a wall-mounted PIN tablet path if the team implements that option).
- **Managers / office** get a trustworthy live view of who is on shift, who is late, and which exceptions need attention.
- **Records** stay fair for pay, disputes, and inspection: original events preserved; corrections logged with who / what / why.
- **Conditions of care work** are first-class: poor signal, outdoor movement between visits, staff trust around location data.

This kit does **not** require Claude or the team to deliver the entire multi-module care platform in one go. Wider platform ideas (care plans, eMAR, full HR, finance) may exist in client-facing materials; **do not pull them into implementation plans** unless a human explicitly opens work and captures it in Linear.

### Outcomes that matter (not a feature checklist)

Speak in outcomes, not a fake ordered backlog:

1. A carer can record attendance even when connectivity is bad.
2. The office can see attendance reality without chasing people by default.
3. Exceptions are reviewable and resolvable without destroying history.
4. Hours that feed timesheets come from clock data people can trust.
5. Location use is proportionate: at clock moments, not continuous tracking.

How those outcomes are sliced into tickets is decided when work appears.

---

## Mindset (from team alignment)

### Unifying minds without dictating method

The team shares product truths and visibility rails. Specialists choose craft:

| Person | Owns | Does not own by default |
| --- | --- | --- |
| **Jesse Ngari** | Best Pinnacle communication; client-facing clarity; elevating policy questions | Day-to-day implementation methods |
| **Gichogu Macharia** | Helping the collaboration environment (tools, visibility, unblocking) | Dictating frontend/backend/design craft |
| **Athaliah Kisochi** | Improving the **current** design with the team | Solo greenfield product ownership without collaboration |
| **Dennis Kabui** | Frontend phone & office experience implementation | Client negotiation; inventing backend policy |
| **Ian Ndegwa** | Backend official records, APIs, trust boundaries | Visual design craft; client negotiation |

### Principles

- **Align, don’t control.** Shared story + visible work + free craft.
- **Visibility over surveillance.** Linear + GitHub so people can see progress without micromanaging method.
- **Uncertainty is normal.** Unknown next task is expected; skills exist for that.
- **Open decisions stay labeled open.** Especially client policy and unresolved stack choices.

---

## Timeboxes

| Sprint | Meaning (coarse) |
| --- | --- |
| **Sprint 1** | Build and connect the experience — pieces start working together |
| **Sprint 2** | Test and refine — quality under real conditions, polish, fix what usage reveals |

There is **no** day-level task schedule in this file. There is **no** invented ordered backlog. Cycles exist so the team can talk about “where we are” without pretending every hour is planned.

When someone asks “are we in Sprint 1 or 2?”, answer from the team’s actual Linear cycle language — do not invent a new phase system.

---

## When new work appears

Use this path every time work becomes real. It is a **shape**, not a bureaucracy.

### 1. Capture intent in Linear (`BES-xxx`)

Write the **outcome** and context. Do not fake certainty about method if method is still unknown.

Minimum useful fields:

- **Title** — verb + object (“Show offline pending state on clock-in button”)
- **Why / context** — who hurts if this is wrong
- **Outcome** — what “done” means in user or system terms
- **Known constraints** — offline, audit, ticket dependencies
- **Open questions** — explicitly listed
- **Assignee** — when known; otherwise unassigned is fine briefly
- **Cycle** — Sprint 1 or Sprint 2 when the team uses cycles

If the work came from Best Pinnacle, Jesse should ensure the ticket language matches what the client actually asked — not an engineered reinterpretation.

### 2. Branch linked to the ticket

Short-lived branch from the team’s default branch, name includes ticket id:

- `feat/BES-123-short-slug`
- `fix/BES-123-short-slug`
- `chore/BES-123-short-slug`
- `docs/BES-123-short-slug`

### 3. Implement the smallest honest slice

Prefer a thin vertical or a clearly scoped horizontal change that can be reviewed. If discovery expands scope, **split**: finish a safe PR, open a new ticket for the rest.

### 4. Open a PR with the ticket id

PR description should say:

- What changed and why
- How to verify
- Product truths touched (offline, audit, location, etc.)
- Open decisions left open
- Screenshots / notes for UI when relevant

Review; merge when expectations for that slice are met.

### 5. Update Linear status honestly

Typical flow (names may match Linear workflow labels the team configured):

`Backlog / Todo → In Progress → In Review → Done`

Automations may move status when PRs open/merge; if they don’t, humans update. Silent “done in chat only” is a failure mode.

### 6. Notion only for durable knowledge

Write to Notion when something should outlive the ticket: decision, schema note, client-confirmed policy, design rationale. **Do not** run the project from Notion task lists.

---

## Open questions (do not silently decide)

These may still be open; treat as **explicit** until closed by the right people:

| Topic | Who typically closes it |
| --- | --- |
| Location mode: record-only / warn / strict enforce | Jesse + Best Pinnacle (team implements once clear) |
| Grace periods for late / early | Jesse + Best Pinnacle |
| Timesheet period | Jesse + Best Pinnacle |
| SMS / alert channel choices | Jesse + Best Pinnacle; Ian/Dennis implement |
| PIN tablet need and count | Jesse + Best Pinnacle |
| Offline storage approach on device | Dennis (+ Ian for sync contract) |
| Styling / design system details | Athaliah with Dennis |
| Exact API shapes and auth model details | Ian with Dennis |
| Hosting / UK residency operational confirmation | Jesse / ops as applicable; Ian respects constraints in code |

If Claude is asked to “just pick one”, pick a **reversible default**, document the assumption in the PR, and flag the open question — do not present it as client-signed policy.

---

## Product truths (process-level reminder)

When writing tickets, PRs, or acceptance notes, protect:

1. **Tap → intentional event** with a clear time story  
2. **One official attendance record** despite retries  
3. **Offline queue + sync** as normal path  
4. **Append-only correction history** for manager edits  
5. **Location only at clock moments**  
6. **Office visibility from real events**  

Full coding conventions live in `skills/clock-in-conventions.md`. Carer story in plain language: `context/product-clock-in.md`.

---

## Related files in this kit

| File | Purpose |
| --- | --- |
| `CLAUDE.md` | Project guide for Claude Code: rules, roles, when to help whom |
| `context/team-alignment.md` | Condensed alignment |
| `context/product-clock-in.md` | Carer and office narrative |
| `skills/README.md` | Index of skills |
| `skills/uncertain-work.md` | Approach when method is unknown |
| `skills/issue-handling.md` | Linear + GitHub issue craft |
| `skills/pr-and-review.md` | Branch/PR/review practices |
| `skills/cross-role-handoffs.md` | Handoff patterns between roles |
| `skills/clock-in-conventions.md` | Product truths + coding guidance |
| `skills/client-comms-jesse.md` | Client communication skill for Jesse |
| `skills/pm-environment-gichogu.md` | PM environment help without craft control |

Outside this folder (elsewhere in the builder environment), also useful:

- GitHub issue/PR templates  
- Linear ↔ GitHub integration notes  
- Accountability / visibility model  
- Figma handoff notes for design → frontend  

Claude should not invent parallel process docs; point humans at existing rails.

---

## How Claude should use this file

- At session start on this repo: read this + `CLAUDE.md` if not already in context.  
- When a new idea appears: follow **When new work appears**, load `uncertain-work` if method is unclear.  
- When writing code: load `clock-in-conventions` and the relevant handoff skill.  
- When drafting client text: load `client-comms-jesse`.  
- When PM tooling questions arise: load `pm-environment-gichogu`.  
- Never replace this guideline with a generated “project plan.md” full of invented tasks.

---

## Anti-patterns for process

- “I’ll track my work only in my head / WhatsApp”  
- Notion as the only place tickets live  
- PRs without ticket ids for real product work  
- Mega-PRs that mix discovery, redesign, and infra  
- PM or CEO assigning CSS technique or database library as mandate  
- Closing open client decisions in code comments only  
- Pretending Sprint 2 means a prewritten test script for every unknown  

---

## Success looks like

- Anyone on the team can open Linear and see what is in flight.  
- Anyone can open GitHub and see what is proposed or merged.  
- Carers get a simple, reliable clock action.  
- Managers get truth they can defend.  
- Specialists still choose how to build.  
- Jesse can speak to Best Pinnacle without contradicting the product.  
- Gichogu can keep the rails healthy without becoming the bottleneck for every code decision.  

This guideline is complete when it helps the next piece of work appear cleanly — not when it pretends the future is fully planned.
