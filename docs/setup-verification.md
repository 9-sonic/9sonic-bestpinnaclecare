# Setup status — Best Pinnacle Care delivery

**Repo:** https://github.com/9-sonic/9sonic-bestpinnaclecare  
**Project:** https://github.com/orgs/9-sonic/projects/1  
**As of:** 2026-07-24  

Process and tracking are in place under the **9-sonic** org. Application code (including Rails) is added only through PRs.

| Item | Status | Notes |
|------|--------|--------|
| Org ownership | Active | Transferred to `9-sonic` |
| Private monorepo layout | Active | `/pwa` `/admin-web` `/backend` `/contracts` `/docs` |
| CONTRIBUTING | Active | Features, bugs, board, PR gate; branch ≠ delivery |
| Delivery guide | Active | `docs/project-management.md` |
| Stack expectations | Active | Rails in `/backend` — `docs/tech-stack.md` |
| Issue templates | Active | Feature, Bug, Build Task |
| PR template + DoD | Active | |
| Labels + milestones | Active | |
| Project linked to repo | Active | `9-sonic/9sonic-bestpinnaclecare` |
| Board items | Active | Issues on project (Must Ready / Should+Could Backlog) |
| Board Status columns | Active | Backlog → Ready → In Progress → In Review → Done |
| Work type field | Active | Feature / Bug / Chore |
| Named views (Board / Table / Roadmap) | Configure once | Rename View 1 / View 4; add Roadmap |
| Project UI workflows | Configure on project | ⋯ → Workflows: auto-add, closed → Done, PR merged → Done |
| CI + secret scan | Active | |
| Template gate (PR hygiene) | Active | **Fails** incomplete PR templates |
| Path auto-labels | Active | `.github/labeler.yml` |
| Project board sync | Active | Optional secret `PROJECT_TOKEN` for org project write |
| Request Copilot review | Active | Every non-draft PR open / push |
| Fireworks AI PR review | Active | Secret `FIREWORKS_API_KEY`; model `kimi-k2p7-code` |
| Main push guard | Active | Warns on direct non-merge pushes to `main` |
| Branch protection / Copilot ruleset | Needs GitHub Pro | Free org plan |
| Auto-delete branches | Off | Intentional |
| Application code | Via PRs only | No pre-scaffolded Rails/app code |

---

## Project UI (if not already applied)

### Views

1. Open https://github.com/orgs/9-sonic/projects/1  
2. Rename board layout tab → **Board**  
3. Rename table tab → **Table**  
4. **+ New view** → **Roadmap** → group by **Milestone**  

### Workflows

**⋯ → Workflows** — enable auto-add, item closed → Done, PR merged → Done.

### Branch protection (when GitHub Pro is available)

Protect `main`: PR required, 1 approval, dismiss stale, conversation resolution, include admins, require **CI summary** + Template gate. Ruleset: auto-request Copilot.

---

## Ready means

1. What to pick up → Board **Ready**  
2. Feature vs bug → issue templates  
3. How to ship → **branch → PR into main** (never direct push)  
4. Backend → **Rails in `/backend`**  
