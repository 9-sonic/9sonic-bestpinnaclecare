# Setup status — Best Pinnacle Care delivery

**Repo:** https://github.com/9-sonic/9sonic-bestpinnaclecare  
**Project:** https://github.com/orgs/9-sonic/projects/1  
**As of:** 2026-07-24  

Process and tracking are in place under the **9-sonic** org. Application code (including Rails) is added only through PRs.

| Item | Status | Notes |
|------|--------|--------|
| Org ownership | Active | Transferred to `9-sonic` |
| Private monorepo layout | Active | `/pwa` `/admin-web` `/backend` `/contracts` `/docs` |
| CONTRIBUTING | Active | Features, bugs, board, PR gate |
| Delivery guide | Active | `docs/project-management.md` |
| Stack expectations | Active | Rails in `/backend` — `docs/tech-stack.md` |
| Issue templates | Active | Feature, Bug, Build Task |
| PR template + DoD | Active | |
| Labels + milestones | Active | |
| Project linked to repo | Active | `9-sonic/9sonic-bestpinnaclecare` |
| Board items | Active | 21 issues restored after transfer (Must → Ready; Should/Could → Backlog) |
| Board Status columns | Active | Backlog → Ready → In Progress → In Review → Done |
| Work type field | Active | Feature / Bug / Chore |
| Named views (Board / Table / Roadmap) | Configure once | Default tabs may still show “View 1” / “View 4” — rename + add Roadmap below |
| Project workflows | Configure on project | ⋯ → Workflows: auto-add, closed → Done, PR merged → Done |
| CI + secret scan + PR hygiene | Active | |
| Branch protection / Copilot ruleset | When GitHub Pro is on | Until then: assign Copilot on every PR by hand |
| Auto-delete branches | Off | Intentional |
| Application code | Via PRs only | No pre-scaffolded Rails/app code |

---

## After org transfer (what broke and what was fixed)

Transferring the repo to **9-sonic** moved the project to the org (`projects/1`). **Status columns and custom fields kept**; **board items did not**. Views also reset to generic names (“View 1”, “View 4”).

**Restored:**

- Repo re-linked to the org project  
- All open issues re-added with correct **Status** and **Work type**  

**Still configure in the project UI (API cannot rename/create views):**

### Views

1. Open https://github.com/orgs/9-sonic/projects/1  
2. On the **board** tab (layout with columns): open the view menu → **Rename** → **Board**  
3. On the **table** tab: rename → **Table**  
4. **+ New view** → **Roadmap** → name **Roadmap** → group by **Milestone**  

### Workflows

**⋯ → Workflows** — enable:

| Workflow | Behaviour |
|----------|-----------|
| Auto-add to project | Issues and PRs from `9-sonic/9sonic-bestpinnaclecare` |
| Item closed | → Done |
| Pull request merged | Linked issues → Done |

### Branch protection and Copilot auto-request

When **GitHub Pro** (or org plan that allows it) is available:

- Protect `main`: PR required, 1 approval, dismiss stale, conversation resolution, include admins, require **CI summary**  
- Ruleset: auto-request **Copilot** review on PRs to `main`  

Until then: every PR assigns Copilot by hand; CI and secret scan stay green.

---

## Team access

Collaborators / org members with **Write** work from **Ready**, follow CONTRIBUTING, and open PRs.

---

## Ready means

Anyone with access can answer from GitHub alone:

1. What to pick up → Board **Ready**  
2. Feature vs bug → issue templates  
3. How status moves → CONTRIBUTING  
4. How to ship → branch → PR → Copilot → CI → PM  
5. Backend → **Rails in `/backend`**  
6. Plan over 15 days → Roadmap + milestones  
