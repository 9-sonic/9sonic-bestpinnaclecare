# Project management view — Best Pinnacle Care

For the **PM** (and freelancers who need the big picture).

**Project:** [Best Pinnacle](https://github.com/users/Mr-Macharia/projects/3)  
**Repo:** [9sonic-bestpinnaclecare](https://github.com/Mr-Macharia/9sonic-bestpinnaclecare)

---

## Views on one project (do not create a second board)

| View | Use for |
|------|---------|
| **Board** | Day-to-day status: Backlog → Ready → In Progress → In Review → Done |
| **Roadmap** | Plan over the 15-day build + test window; group by milestone (create once in UI — see setup-verification) |
| **Table** (if present) | Bulk scan of titles, milestones, labels, **Work type** |

**Work type** field on every card: Feature · Bug · Chore (existing backlog items are set to Feature).

All cards are the **same items**. Views are different lenses, not different backlogs.

---

## Status meanings (must match the board)

| Status | PM question it answers |
|--------|------------------------|
| Backlog | What’s defined but not released for pickup? |
| Ready | What can a freelancer start tonight? |
| In Progress | What’s actively being built? |
| In Review | What’s waiting on Copilot / me? |
| Done | What shipped since the last WhatsApp call? |

---

## Milestones

| Milestone | Content |
|-----------|---------|
| Sprint 1 — Foundation | Must M1–M11 |
| Sprint 1 — Should | S12–S16 (pull forward only if Must is healthy) |
| Sprint 1 — Could | C17–C20 (capacity only) |
| Sprint 2 — Test | Days 16–22 testing (fill as bugs/tasks appear) |

---

## How work types hit the board

| Type | How it appears | Default Status |
|------|----------------|----------------|
| Backlog story `[M#]` | Already filed | Ready |
| Backlog `[S#]` / `[C#]` | Already filed | Backlog |
| New **Feature** | Issue template | Backlog until you move to Ready |
| **Bug** critical/high | Issue template | Ready (may cut the line) |
| **Bug** low | Issue template | Backlog |
| **Pull request** | From freelancers | In Review |

---

## 3–4 day WhatsApp check-in agenda

1. **Done** — what merged since last call (board Done + merged PRs).  
2. **In Review** — any PR stuck on Copilot or waiting on you.  
3. **In Progress** — still on track? blocked?  
4. **Ready** — enough clear work for the next evenings?  
5. **Bugs** — any `priority:critical`?  
6. **Roadmap** — still on track for demo Must items?

### Labels to filter when time is short

- `priority:critical`  
- `scope:contracts`  
- `status:blocked`  
- `moscow:must`  
- `copilot:issues-found` / `needs:pm-approval`

---

## Promoting work

- **Should → Ready:** only if Must milestone is not at risk.  
- **Could → Ready:** only if ahead of schedule.  
- **Bug critical:** Ready immediately; may pause a feature.  

Comment on the issue when you change priority so freelancers see why.

---

## Project workflows (automatic card moves)

These are **not** GitHub Actions. They live on the project:

**Board → ⋯ → Workflows**

Enable at least:

1. **Auto-add to project** — new issues/PRs from `9sonic-bestpinnaclecare`  
2. **Item closed** → Done  
3. **Pull request merged** → linked issues → Done  

Until enabled, update Status by hand.

---

## What you do not need to do

- Write application code  
- Drag every card if workflows are on  
- Create a second project named “roadmap” — use the **Roadmap view** on this project  

---

## Residual account limits

Private free accounts may block **branch protection** and **Copilot auto-request rulesets** until GitHub Pro. Process still works via PR template + PR hygiene bot + manual Copilot assign. Details: [setup-verification.md](./setup-verification.md).
