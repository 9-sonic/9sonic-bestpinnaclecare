# Setup verification — process-ready project

**Repo:** https://github.com/Mr-Macharia/9sonic-bestpinnaclecare  
**Board:** https://github.com/users/Mr-Macharia/projects/3  
**Last updated:** 2026-07-23  

This repo is prepared for **project management and contribution process**. Application code (including Rails) is **not** scaffolded; freelancers add it via PRs.

| Item | Status | Notes |
|------|--------|--------|
| Private monorepo folders | **Done** | Empty of app code by design |
| CONTRIBUTING.md | **Done** | Issues, features, bugs, board, PR gate |
| PM guide | **Done** | `docs/project-management.md` |
| Tech expectations | **Done** | Rails backend stated in `docs/tech-stack.md` |
| Issue templates | **Done** | Feature, Bug, Build Task + chooser |
| PR template + DoD | **Done** | |
| Labels + milestones | **Done** | |
| 20 backlog issues | **Done** | M Ready; S/C Backlog |
| Board columns | **Done** | Backlog → Ready → In Progress → In Review → Done |
| Work type field | **Done** | Feature / Bug / Chore on project |
| Roadmap view | **Manual** | Create once in UI (API cannot create views) — steps below |
| Board rename views | **Manual** | Rename “View 1” → Table, board view → Board if desired |
| Project workflows | **Manual** | ⋯ → Workflows |
| CI + secret scan + PR hygiene | **Done** | |
| Branch protection / Copilot ruleset | **Blocked without Pro** | Free private limit |
| Collaborators | **Not added** | By design (invite later) |
| Auto-delete branches | **Off** | No-delete policy |
| Application / Rails code | **Not written** | By design |

---

## Manual: add Roadmap view (2 minutes)

GitHub’s API cannot create project views. Do this once:

1. Open https://github.com/users/Mr-Macharia/projects/3  
2. Next to existing views, click **+ New view** (or the view tab menu).  
3. Choose **Roadmap** (timeline).  
4. Name it **Roadmap**.  
5. Group or filter by **Milestone** (Foundation / Should / Could / Test).  
6. Optional: rename other views to **Board** and **Table**.

You now have Board (status) + Roadmap (plan) on the **same** project.

---

## Manual: enable project workflows

**Board → ⋯ → Workflows** → enable:

| Workflow | Setting |
|----------|---------|
| Auto-add to project | Issues + PRs from `9sonic-bestpinnaclecare` |
| Item closed | → **Done** |
| Pull request merged | Linked issues → **Done** |

---

## Manual: GitHub Pro (optional but recommended)

Enables branch protection on `main` and ruleset **Auto-request Copilot review**.  
Until then: freelancers assign Copilot manually; PR hygiene bot reminds them.

---

## When you invite freelancers later

1. Settings → Collaborators → Write access.  
2. Send them: repo URL + CONTRIBUTING + board link.  
3. They pick from **Ready** only.

---

## Process-ready definition (met)

A freelancer can answer without WhatsApp:

1. Where is my work? → Board **Ready**  
2. Feature vs bug? → Issue templates  
3. How does status move? → CONTRIBUTING lifecycle  
4. How do I ship? → Branch → PR → Copilot → CI → PM  
5. Backend? → **Rails in `/backend`**  
6. 15-day plan? → Roadmap + milestones (after Roadmap view created)
