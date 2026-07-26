# Setup status — Best Pinnacle Care delivery

**Repo:** https://github.com/9-sonic/9sonic-bestpinnaclecare  
**GitHub Project:** https://github.com/orgs/9-sonic/projects/1  
**Linear team:** https://linear.app/best-pinnacle/team/BES (`BES-xxx`)  
**As of:** 2026-07-26  

Process and dual-board rails are live. Application code lands only through PRs into `main`.

## Monorepo layout (current)

| Path | Status | Notes |
|------|--------|--------|
| `/` (root) | Active | **Rails 8 API** (`app/`, `Gemfile`, …) |
| `client/pwa` | Active path | Carer PWA |
| `client/admin-web` | Active path | Manager web |
| `contracts/` | Expected | Shared API shapes when used |
| `docs/` | Active | Process + product notes |
| `.claude/` | Active | Claude/Cursor project rails |

Older docs that say `/pwa`, `/admin-web`, `/backend` mean **`client/pwa`**, **`client/admin-web`**, and **Rails at root**.

## Process & automation

| Item | Status | Notes |
|------|--------|--------|
| Org ownership | Active | `9-sonic` |
| CONTRIBUTING + join-and-go | Active | BES dual board documented |
| Dual-board map | Active | `docs/dual-board.md` |
| Issue templates | Active | Feature, Bug, Build Task |
| PR template + template gate | Active | Requires issue link or `Process-only: true` |
| Labels + path auto-labels | Active | |
| GitHub Project board | Active | Best Pinnacle |
| Linear team BES + epics | Active | Must path Ready (BES-5…15) |
| CI + secret scan | Active | Rails root + client paths |
| Request Copilot review | Active | Often quota-limited; manual assign fallback |
| Fireworks AI review | Active | Goal-aware; secret `FIREWORKS_API_KEY` |
| Main push guard | Active | Warn only (no Pro branch protection) |
| Deploy on main | Active | Path-scoped SSH/rsync (`deploy.yml`) |
| Branch protection / rulesets | Needs GitHub Pro | Free org plan — process + Actions approximate |
| Linear cycles Sprint 1/2 | Manual | Open ticket BES-28 / Linear UI |
| Linear ↔ GitHub integration | Manual | OAuth in Linear Settings |
| Team invites (all five) | Deferred | Use join-and-go when ready |
| Figma rail | Deferred | Later |

## Ready means

1. What to pick up → Linear **Ready** (Must) and/or GitHub Project Ready  
2. Branch → `feat/BES-n-…` from `main`  
3. Ship → **PR into main** with `BES-n` and/or `Closes #n`  
4. Reviews → Fireworks (+ Copilot if available) + green checks  
5. Backend → **Rails at repo root**; frontends under **`client/`**

## See also

- [join-and-go.md](./join-and-go.md)  
- [dual-board.md](./dual-board.md)  
- [fireworks-review.md](./fireworks-review.md)  
- [builder-environment.md](./builder-environment.md)  
