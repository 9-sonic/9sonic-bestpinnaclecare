# 9Sonic — Best Pinnacle Care

Private monorepo for the **15-day Clock In / Clock Out build** for Best Pinnacle Care.

GitHub is the single source of truth. Product code lands here through pull requests — nothing is invented in side repos. **Backend is Ruby on Rails** — an API-only app at the repository root. The frontend lives under `/client`.

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
| [`/` (root)](./) | **Rails 8 API-only** app — auth, shifts, rotas, clocking, timesheets, staff chat |
| [`/client`](./client) | Frontend SPA — [`client/pwa`](./client/pwa) (carer PWA) + [`client/admin-web`](./client/admin-web) (manager web); `/admin` and `/staff` are **routes** |
| [`/contracts`](./contracts) | Shared API shapes between the client apps and the Rails API |
| [`/docs`](./docs) | Process, backlog, delivery notes, and the Phase-1 build spec ([`context.md`](./docs/context.md)) |

### Contracts rule

A PR that changes `/contracts` without a matching consumer change in `/client` or the Rails API (root) is incomplete. The carer app, manager app, and Rails API must stay aligned.

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
- Shipping path: **branch → open PR into `main`** (required) → Copilot / Fireworks → CI green → PM → merge  
- **Never push straight to `main`** — reviews only show on a PR  

Full rules: **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

### Must build order

Auth + Rails foundation → shifts → carer dashboard → clock in/out → offline → live board → alerts → timesheets → export.

---

## Starting work (developers)

1. Read [CONTRIBUTING.md](./CONTRIBUTING.md).  
2. Open the [board](https://github.com/orgs/9-sonic/projects/1) → take from **Ready**.  
3. Comment `Taking this`, set status **In Progress**, branch from `main` (do not commit on `main`).  
4. **Open a PR into `main`** with `Closes #…` — a branch alone is not delivery.  
5. Keep checks green; Rails changes live at the repo root, frontend changes under `/client`.

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
| **Template gate** (PR hygiene) | **Fails** if issue link, scope, or UI screenshot is missing |
| **Path labels** | Adds `scope:*` from changed folders |
| **Board sync** | Linked issues → In Review on PR; Done on merge (Best Pinnacle project) |
| **Fireworks AI review** | Sticky AI review on PRs (`FIREWORKS_API_KEY`; default Kimi K2.7 Code) |
| **Main push guard** | Warns in Actions if `main` is updated without a clear PR merge |
| **Deploy** | On merge to `main`, SSH + rsync to the Virtualmin host; deploys backend and/or client per changed paths (`deploy.yml`) |

Details: [docs/ci.md](./docs/ci.md). Project UI workflows (⋯ → Workflows) remain useful as a backup for auto-add.

---

## House rules

- One project only: **Best Pinnacle** (Board + Roadmap + Table).  
- Do not delete issues, milestones, or project history to “clean up.”  
- Branches are not auto-deleted.  
- No secrets in git.  
- App code (Rails, PWA, admin) arrives only via issue-linked PRs.
