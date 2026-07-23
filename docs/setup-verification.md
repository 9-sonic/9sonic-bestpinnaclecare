# Setup status — Best Pinnacle Care delivery

**Repo:** https://github.com/Mr-Macharia/9sonic-bestpinnaclecare  
**Project:** https://github.com/users/Mr-Macharia/projects/3  
**As of:** 2026-07-23  

Process and tracking are in place. Application code (including Rails) is added only through PRs.

| Item | Status | Notes |
|------|--------|--------|
| Private monorepo layout | Active | `/pwa` `/admin-web` `/backend` `/contracts` `/docs` |
| CONTRIBUTING | Active | Features, bugs, board, PR gate |
| Delivery guide | Active | `docs/project-management.md` |
| Stack expectations | Active | Rails in `/backend` — `docs/tech-stack.md` |
| Issue templates | Active | Feature, Bug, Build Task |
| PR template + DoD | Active | |
| Labels + milestones | Active | |
| Backlog issues | Active | #1–#11 Ready; #12–#20 Backlog |
| Board Status columns | Active | Backlog → Ready → In Progress → In Review → Done |
| Work type field | Active | Feature / Bug / Chore |
| Roadmap view | Configure on project | **+ New view → Roadmap** if not visible; group by Milestone |
| Project workflows | Configure on project | ⋯ → Workflows: auto-add, closed → Done, PR merged → Done |
| CI + secret scan + PR hygiene | Active | |
| Branch protection / Copilot ruleset | Account limit | Private free tier; enable under Pro if/when the account has it |
| Auto-delete branches | Off | Intentional |
| Application code | Via PRs only | No pre-scaffolded Rails/app code |

---

## Project UI configuration (if not already applied)

### Roadmap view

1. Open [Best Pinnacle](https://github.com/users/Mr-Macharia/projects/3).  
2. **+ New view** → **Roadmap**.  
3. Name: **Roadmap**.  
4. Group / filter by **Milestone**.  
5. Rename other views to **Board** and **Table** if names are still generic.

### Workflows

**⋯ → Workflows** — enable:

| Workflow | Behaviour |
|----------|-----------|
| Auto-add to project | Issues and PRs from this repo |
| Item closed | → Done |
| Pull request merged | Linked issues → Done |

### Branch protection and Copilot auto-request

Requires GitHub Pro (or equivalent) on a private repo. When available:

- Protect `main`: PR required, 1 approval, dismiss stale, conversation resolution, include admins, require **CI summary**  
- Ruleset: auto-request **Copilot** review on PRs to `main`  

Until then the process still holds: every PR assigns Copilot by hand; PR hygiene and CI enforce the rest.

---

## Team access

Collaborators with **Write** on the repo work from **Ready**, follow CONTRIBUTING, and open PRs. Access is granted when people join the build — not as a separate “setup phase.”

---

## Ready means

Anyone with access can answer from GitHub alone:

1. What to pick up → Board **Ready**  
2. Feature vs bug → issue templates  
3. How status moves → CONTRIBUTING  
4. How to ship → branch → PR → Copilot → CI → PM  
5. Backend → **Rails in `/backend`**  
6. Plan over 15 days → Roadmap + milestones  
