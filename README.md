# 9Sonic — Best Pinnacle Care

Private monorepo for the **Clock In / Clock Out** build for Best Pinnacle Care.

| Truth | Tool |
|-------|------|
| **Code & merge** | This GitHub repo (PR-only into `main`) |
| **Day-to-day status** | Linear team [Best Pinnacle](https://linear.app/best-pinnacle/team/BES) (`BES-xxx`) |
| **Knowledge** | Notion Engineering Hub (not a task board) |

**Backend is Ruby on Rails** at the repository root. Frontends live under `/client`.  
Product name may say “BPC”; Linear issue ids are always **`BES-xxx`**.

| Resource | Link |
|----------|------|
| **Join and go (new people)** | [docs/join-and-go.md](./docs/join-and-go.md) |
| **How the team works** | [CONTRIBUTING.md](./CONTRIBUTING.md) |
| **Docs index** | [docs/README.md](./docs/README.md) |
| **Dual board (BES map)** | [docs/dual-board.md](./docs/dual-board.md) |
| **Linear team** | [Best Pinnacle (BES)](https://linear.app/best-pinnacle/team/BES) |
| **GitHub Project** | [Best Pinnacle](https://github.com/orgs/9-sonic/projects/1) |
| **Definition of Done** | [docs/definition_of_done.md](./docs/definition_of_done.md) |
| **Stack** | [docs/tech-stack.md](./docs/tech-stack.md) |
| **Product backlog** | [docs/backlog.md](./docs/backlog.md) |
| **Fireworks review** | [docs/fireworks-review.md](./docs/fireworks-review.md) |
| **PR/review FAQ** | [docs/faq-pr-reviews.md](./docs/faq-pr-reviews.md) |
| **Builder environment** | [docs/builder-environment.md](./docs/builder-environment.md) · [`.claude/`](./.claude/) |

---

## Monorepo map

| Path | What belongs here |
|------|-------------------|
| [`/` (root)](./) | **Rails 8 API-only** — auth, shifts, clocking, timesheets, jobs |
| [`/client`](./client) | [`client/pwa`](./client/pwa) (carer) + [`client/admin-web`](./client/admin-web) (manager) |
| [`/contracts`](./contracts) | Shared API shapes (when used) |
| [`/docs`](./docs) | Process, backlog, delivery notes ([index](./docs/README.md)) |
| [`.claude/`](./.claude/) | Claude/Cursor project brain |

### Contracts rule

A PR that changes `/contracts` without a matching consumer change in `/client` or the Rails API (root) is incomplete.

---

## How work moves

```text
Backlog → Ready → In Progress → In Review → Done
```

- Prefer **Linear Ready** for Must path (`BES-5`…`BES-15`); GitHub Project mirrors code-adjacent tracking  
- Shipping: **branch → open PR into `main`** → Fireworks (+ Copilot if available) → CI green → merge  
- **Never push product work straight to `main`** — reviews only run on a PR  
- Write status **once** (link Linear `BES-n` ↔ GitHub `#n`)

Full rules: **[CONTRIBUTING.md](./CONTRIBUTING.md)** · map: **[docs/dual-board.md](./docs/dual-board.md)**.

### Must build order

Auth + Rails foundation → shifts → carer dashboard → clock in/out → offline → live board → alerts → timesheets → export.

---

## Starting work (developers)

1. Read **[docs/join-and-go.md](./docs/join-and-go.md)** then [CONTRIBUTING.md](./CONTRIBUTING.md).  
2. Open Linear **Ready** (or [GitHub board](https://github.com/orgs/9-sonic/projects/1) Ready).  
3. Claim the ticket → branch `feat/BES-<n>-short-slug` from `main` (do not commit on `main`).  
4. **Open a PR into `main`** with `BES-<n>` and `Closes #…` when closing a GitHub issue.  
5. Address Fireworks **Blocking** items; keep template gate + CI + secret scan green.

---

## Delivery rhythm (PM)

Check-ins every **3–4 days** (WhatsApp). Between calls, Linear + the board are the status report.

Operating detail: [docs/project-management.md](./docs/project-management.md).

---

## Automation

| Automation | Role |
|------------|------|
| **CI** | Layout hygiene; package checks when code appears |
| **Secret scan** | Blocks obvious committed secrets |
| **Request Copilot review** | Requests Copilot (may hit plan/quota limits) |
| **Template gate** | Fails if issue link / scope incomplete |
| **Path labels** | Adds `scope:*` from changed folders |
| **Board sync** | GitHub Project: In Review / Done with PRs |
| **Fireworks AI review** | Goal-aware review for PM merge gate (`FIREWORKS_API_KEY`) |
| **Main push guard** | Warns on direct non-merge pushes to `main` |
| **Deploy** | Path-scoped SSH/rsync on merge to `main` |

Details: [docs/ci.md](./docs/ci.md) · [docs/fireworks-review.md](./docs/fireworks-review.md).

---

## House rules

- Dual board: GitHub = code, Linear = status, Notion = knowledge.  
- Do not delete issues or history to “clean up.”  
- No secrets in git.  
- Branch alone is not delivery.
