# Setup verification — 9Sonic Best Pinnacle Care

**Repo:** https://github.com/Mr-Macharia/9sonic-bestpinnaclecare  
**Board:** https://github.com/users/Mr-Macharia/projects/3  
**Configured:** 2026-07-23  

| Item | Status | Notes |
|------|--------|--------|
| Private monorepo `Mr-Macharia/9sonic-bestpinnaclecare` | **Done** | Created fresh; unrelated `9sonic/*` repos ignored |
| Folders `/pwa` `/admin-web` `/backend` `/contracts` `/docs` | **Done** | On `main` |
| Merged issue template | **Done** | `.github/ISSUE_TEMPLATE/build-task.md` |
| Merged PR template | **Done** | `.github/pull_request_template.md` |
| Definition of Done + CI docs + backlog copy | **Done** | Under `/docs` |
| Labels (setup + MoSCoW/size/owner) | **Done** | 27 custom labels |
| Milestones | **Done** | Foundation / Should / Could / Sprint 2 Test |
| Project board columns | **Done** | Backlog · Ready · In Progress · In Review · Done |
| Repo linked to project #3 | **Done** | |
| Issues M1–M11 on **Ready** | **Done** | Issues #1–#11 |
| Issues S12–S16 + C17–C20 on **Backlog** | **Done** | Issues #12–#20 |
| Won’t issues | **Skipped** | By design |
| Assignees | **None** | By design |
| CI workflow | **Done** | Green on foundation push |
| Secret scan (Gitleaks) | **Done** | Green on foundation push |
| PR hygiene bot (Copilot + template reminders) | **Done** | Soft automation for free private plan |
| Branch protection on `main` | **Blocked (plan)** | Requires GitHub Pro on private repos |
| Ruleset auto-request Copilot | **Blocked (plan)** | Requires GitHub Pro on private repos |
| Project built-in workflows toggles | **Manual residual** | API cannot enable; UI steps below |

---

## Residual steps for you (short)

### A. Unlock full protection + Copilot auto-assign (recommended)

1. Upgrade the account that owns the private repo to **GitHub Pro** (or move the repo to a Team/Enterprise org).
2. Then either re-run setup or apply manually:
   - **Settings → Branches → Add branch protection rule** for `main`:
     - Require PR before merging  
     - Require 1 approval  
     - Dismiss stale approvals  
     - Require conversation resolution  
     - Include administrators  
     - Require status check **`CI summary`**  
     - No force pushes / no deletions  
   - **Settings → Rules → Rulesets → New branch ruleset** named `Auto-request Copilot review`:
     - Target default branch  
     - Pull requests → **Request pull request review from Copilot**

Until then: freelancers assign **Copilot** under Reviewers on every PR. The PR hygiene bot will remind them.

### B. Project board workflows (2 minutes)

Open https://github.com/users/Mr-Macharia/projects/3 → **⋯** → **Workflows** → enable:

| Workflow | Suggested setting |
|----------|-------------------|
| **Auto-add to project** | Issues + PRs from `9sonic-bestpinnaclecare` → new issues **Backlog**, new PRs **In Review** |
| **Item closed** | → **Done** |
| **Pull request merged** | Linked issues → **Done** |

(Items already on the board were placed correctly: Must = Ready, Should/Could = Backlog.)

### C. Invite freelancers

**Settings → Collaborators** → add GitHub usernames with **Write** access.

---

## Day-one PM checklist

1. Open the [board](https://github.com/users/Mr-Macharia/projects/3) — Must items are in **Ready**.  
2. Share the repo URL with freelancers; tell them to pick from Ready, branch from `main`, open PR with template.  
3. On every PR: confirm Copilot reviewed, CI green, screenshot if UI, contracts not drifting alone.  
4. When you get Pro: flip residual A above so the process enforces itself.
