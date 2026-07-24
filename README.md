# 9Sonic — Best Pinnacle Care

Private monorepo for the **15-day Clock In / Clock Out build** for Best Pinnacle Care.

GitHub is the single source of truth. Product code lands here through pull requests — nothing is invented in side repos. **Backend is Ruby on Rails** under `/backend`.

| Resource | Link |
|----------|------|
| **Project (board + roadmap)** | [Best Pinnacle](https://github.com/orgs/9-sonic/projects/1) |
| **How the team works** | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| **How delivery is run** | [docs/project-management.md](./docs/project-management.md) |
| **Definition of Done** | [docs/definition_of_done.md](./docs/definition_of_done.md) |
| **Stack expectations** | [docs/tech-stack.md](./docs/tech-stack.md) |
| **Product backlog (source)** | [docs/backlog.md](./docs/backlog.md) |

---

## Monorepo map

| Path | What belongs here |
|------|-------------------|
| [`/pwa`](./pwa) | Carer mobile PWA — offline clock-in/out, GPS, shift dashboard |
| [`/admin-web`](./admin-web) | Manager website — live board, alerts, timesheets, export |
| [`/backend`](./backend) | **Rails** API and automation |
| [`/contracts`](./contracts) | Shared API shapes between PWA, admin-web, and Rails |
| [`/docs`](./docs) | Process, backlog, delivery notes |

### Contracts rule

A PR that changes `/contracts` without a matching consumer change in `/pwa`, `/admin-web`, or `/backend` is incomplete. The carer app, manager app, and Rails API must stay aligned.

---

## How work moves

```text
Backlog → Ready → In Progress → In Review → Done
```

- **Board** — what is ready, in flight, in review, or done  
- **Roadmap** — plan against milestones (15-day build + test window)  
- **Must** work (`[M1]`–`[M11]`) sits in **Ready**  
- **Should / Could** sit in **Backlog** until promoted  
- New work uses **Feature**, **Bug**, or **Build Task** issue templates  
- Shipping path: **branch → open PR into `main`** (required) → **Copilot** / Fireworks review → CI green → PM review → merge  
- A branch without a PR is not shipped work

Full rules: **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

### Must build order

Auth + Rails foundation → shifts → carer dashboard → clock in/out → offline → live board → alerts → timesheets → export.

---

## Starting work (developers)

1. Read [CONTRIBUTING.md](./CONTRIBUTING.md).  
2. Open the [board](https://github.com/orgs/9-sonic/projects/1) → take from **Ready**.  
3. Comment `Taking this`, set status **In Progress**, branch from `main`.  
4. **Open a pull request into `main`** (a branch alone is not delivery). Use `Closes #…`, fill the template, keep checks green.  
5. Rails changes go in `/backend` only.

---

## Delivery rhythm (PM)

Check-ins every **3–4 days** (WhatsApp). Between calls, the board is the status report:

- **Done** / merged PRs — what shipped  
- **In Review** — waiting on Copilot or PM  
- **In Progress** — active work and blockers  
- **Ready** — enough clear work for the next evenings  
- **`priority:critical`** — bugs that cut the line  

Operating detail: [docs/project-management.md](./docs/project-management.md).

---

## Automation

| Automation | Role |
|------------|------|
| **CI** | Layout hygiene; package checks when code appears |
| **Secret scan** | Blocks obvious committed secrets |
| **Request Copilot review** | Requests Copilot on every PR open and every new push to that PR |
| **PR hygiene** | Reminds about linked issues, scope, and Copilot if still missing |

Board **Workflows** auto-move cards when enabled on the project (⋯ → Workflows): closed → Done, PR merged → linked issue Done, auto-add new issues/PRs. Until those toggles are on, the team updates **Status** on the board by hand.

---

## House rules

- One project only: **Best Pinnacle** (Board + Roadmap + Table).  
- Do not delete issues, milestones, or project history to “clean up.”  
- Branches are not auto-deleted.  
- No secrets in git.  
- App code (Rails, PWA, admin) arrives only via issue-linked PRs.
