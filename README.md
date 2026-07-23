# 9Sonic — Best Pinnacle Care

Private monorepo prepared for **delivery management** of the 15-day Clock In / Clock Out build.

**Product code is not pre-written here.** Freelancers add it under the folders below via pull requests.  
**Backend expectation:** **Ruby on Rails** in `/backend` (see [docs/tech-stack.md](./docs/tech-stack.md)).

| Resource | Link |
|----------|------|
| **Project board + roadmap** | [Best Pinnacle](https://github.com/users/Mr-Macharia/projects/3) |
| **How we work** | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| **PM check-in guide** | [docs/project-management.md](./docs/project-management.md) |
| **Definition of Done** | [docs/definition_of_done.md](./docs/definition_of_done.md) |
| **Product backlog (source)** | [docs/backlog.md](./docs/backlog.md) |

---

## Monorepo map

| Path | What belongs here |
|------|-------------------|
| [`/pwa`](./pwa) | Carer mobile PWA — offline clock-in/out, GPS, shift dashboard |
| [`/admin-web`](./admin-web) | Manager website — live board, alerts, timesheets, export |
| [`/backend`](./backend) | **Rails** API and automation |
| [`/contracts`](./contracts) | Shared API shapes between PWA, admin-web, and Rails |
| [`/docs`](./docs) | Process, backlog, PM notes |

### Contracts red flag (PM)

PRs that touch `/contracts` without a matching consumer change may break the handshake between carer and manager apps. Ask which PR consumes the change.

---

## How work is managed

```text
Backlog → Ready → In Progress → In Review → Done
```

- **Board view** — daily status  
- **Roadmap view** — plan vs milestones (15-day build + test)  
- **Issues** — Must items start in **Ready**; Should/Could in **Backlog**  
- **New work** — use issue templates: **Feature**, **Bug**, or **Build Task**  
- **Shipping** — short-lived branch → PR (template) → Copilot review → CI green → PM gate → merge  

Full rules: **[CONTRIBUTING.md](./CONTRIBUTING.md)**.

### Suggested Must order

Auth + Rails foundation → shifts → carer dashboard → clock in/out → offline → live board → alerts → timesheets → export.  
Details in CONTRIBUTING.

---

## For freelancers (quick start)

1. Read [CONTRIBUTING.md](./CONTRIBUTING.md).  
2. Open the board → pick from **Ready**.  
3. Comment `Taking this`, set **In Progress**, branch from `main`.  
4. Open a PR with `Closes #…`, assign **Copilot**, keep CI green.  
5. Rails work goes in `/backend`; do not invent another repo.

---

## For the PM (quick start)

1. Use [docs/project-management.md](./docs/project-management.md) for 3–4 day check-ins.  
2. Watch **In Review** and `priority:critical` bugs.  
3. Enable board **Workflows** (⋯ → Workflows) so cards move on close/merge.  
4. When on GitHub Pro: branch protection + Copilot auto-request (see [docs/setup-verification.md](./docs/setup-verification.md)).  
5. Invite freelancers when you are ready (not required for this process setup).

---

## Automation already on

| Automation | Role |
|------------|------|
| **CI** | Path-aware checks when packages exist; always runs layout hygiene |
| **Secret scan** | Fails if secrets look committed |
| **PR hygiene** | Reminds about linked issues and Copilot on private free plans |

**Project workflows** (auto-move board cards) are configured by you on the project UI — not the same as Actions.

---

## Policy notes

- **No delete culture:** do not delete issues, milestones, or project history to tidy up; do not rely on auto-delete of branches.  
- **No second board:** one project — Best Pinnacle — with Board + Roadmap views.  
- Application scaffolds (Rails app, frontend apps) arrive via freelancers’ PRs linked to issues.
