# Delivery management — Best Pinnacle Care

How this build is run. Clear statuses; dual read / single write across GitHub and Linear.

**GitHub Project:** [Best Pinnacle](https://github.com/orgs/9-sonic/projects/1)  
**Linear:** [Best Pinnacle](https://linear.app/best-pinnacle/team/BES) (`BES-xxx`)  
**Repo:** [9sonic-bestpinnaclecare](https://github.com/9-sonic/9sonic-bestpinnaclecare)  
**Map:** [dual-board.md](./dual-board.md)

---

## Views (same cards, different lenses)

| View | Purpose |
|------|---------|
| **Board** | Daily status: Backlog → Ready → In Progress → In Review → Done |
| **Roadmap** | Plan vs time / milestones for the 15-day build and test window |
| **Table** | Scan titles, milestones, labels, **Work type** |

**Work type:** Feature · Bug · Chore. Existing backlog stories are Feature.

If the Roadmap tab is missing, add it once on the project: **+ New view** → **Roadmap** → name **Roadmap** → group by **Milestone**. Rename other tabs to **Board** and **Table** if they still show generic names.

---

## Status meanings

| Status | Question answered |
|--------|-------------------|
| Backlog | Defined but not released for pickup |
| Ready | Clear for an evening start |
| In Progress | Being built now |
| In Review | PR open — Copilot / PM |
| Done | Merged and accepted |

---

## Milestones

| Milestone | Content |
|-----------|---------|
| Sprint 1 — Foundation | Must M1–M11 |
| Sprint 1 — Should | S12–S16 (promote only if Must is healthy) |
| Sprint 1 — Could | C17–C20 (capacity only) |
| Sprint 2 — Test | Days 16–22; bugs and verification tasks |

---

## How work lands on the board

| Type | Default Status |
|------|----------------|
| Must `[M#]` | Ready |
| Should / Could | Backlog |
| New Feature | Backlog until marked Ready |
| Bug critical / high | Ready (may cut the line) |
| Bug low | Backlog |
| Open PR | In Review |

---

## Check-in agenda (every 3–4 days)

1. **Done** — merged since last call  
2. **In Review** — stuck on Copilot or PM  
3. **In Progress** — pace and blockers  
4. **Ready** — enough clear work for the next evenings  
5. **Bugs** — any `priority:critical`  
6. **Roadmap** — still on track for Must demo scope  

### Filters when time is short

`priority:critical` · `scope:contracts` · `status:blocked` · `moscow:must` · `copilot:issues-found` · `needs:pm-approval`

---

## Promoting work

- **Should → Ready** only if Foundation Must is not at risk.  
- **Could → Ready** only if ahead of schedule.  
- **Critical bugs** → Ready immediately; feature work may wait.  

Comment on the issue when priority changes so the reason is on the record.

---

## Project workflows

Board automations (not GitHub Actions): **⋯ → Workflows**

Keep enabled:

1. **Auto-add to project** — issues and PRs from `9-sonic/9sonic-bestpinnaclecare`  
2. **Item closed** → Done  
3. **Pull request merged** → linked issues → Done  

If a toggle is off, update Status manually until it is on.

---

## Boundaries

- Application code is not written by the PM.  
- No second project named “roadmap” — use the **Roadmap view**.  
- No deleting issues or milestones for cosmetics.  
- Branch protection and auto-request Copilot need GitHub Pro on this private repo; until that is on the account, every PR still **assigns Copilot manually** and CI must stay green. See [setup-verification.md](./setup-verification.md).
