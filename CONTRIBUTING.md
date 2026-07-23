# Contributing — Best Pinnacle Care (9Sonic)

This repository is **process-ready** for a 15-day build. Product code is added by freelancers through pull requests. The **project manager does not write application code**; freelancers do. GitHub is the single source of truth. WhatsApp is only for cadence and urgent blockers.

**Board:** [Best Pinnacle](https://github.com/users/Mr-Macharia/projects/3)  
**Repo:** https://github.com/Mr-Macharia/9sonic-bestpinnaclecare  

---

## Roles

| Role | Responsibility |
|------|----------------|
| **PM** | Prioritise Ready work, answer operational questions, run the quality gate on PRs, manage the board |
| **Freelancers** | Implement features/bugs in the monorepo, open PRs, respond to Copilot and PM |
| **Copilot** | First automated code review on every PR (assign manually if not auto-requested) |

---

## Monorepo map

| Path | Purpose |
|------|---------|
| `/pwa` | Carer mobile PWA (frontend) |
| `/admin-web` | Manager website (frontend) |
| `/backend` | **Ruby on Rails** API and automation |
| `/contracts` | Shared API shapes / schemas between apps |
| `/docs` | Process, backlog, tech expectations, PM notes |

See [docs/tech-stack.md](./docs/tech-stack.md). **Do not invent a second repository.**

### Contracts red flag (PM)

If a PR changes `/contracts` without updating `/pwa`, `/admin-web`, or `/backend`, the carer and manager apps may disagree with Rails. Ask: *Which PR consumes this change?*

---

## Types of work

Use the right **issue template** when creating new work:

| Type | When to use | Template |
|------|-------------|----------|
| **Build Task** | Planned deliverable with acceptance criteria (same shape as backlog stories) | Build Task |
| **Feature** | New capability not already captured as an `[M#]` / `[S#]` / `[C#]` issue | Feature |
| **Bug** | Something broken or incorrect behaviour | Bug |

**Existing backlog** issues (`[M1]`…`[M11]`, `[S12]`…, `[C17]`…) are already filed. Prefer those over creating duplicates.

### Labels (minimum)

Every issue should have:

- One **`scope:*`** (`scope:pwa`, `scope:admin-web`, `scope:backend`, `scope:contracts`, `scope:docs`)
- One **`type:*`** (`type:feature`, `type:bug`, `type:debt`)
- One **`priority:*`** when known (`priority:critical`, `priority:high`, `priority:low`)
- **`sprint:build`** during the 15-day build (or `sprint:test` in the test window)
- **`client:best-pinnacle-care`** for client-visible work
- MoSCoW helpers when relevant: `moscow:must` / `should` / `could`

---

## Board lifecycle (Status)

All work uses the **same Status values** on the Best Pinnacle board:

```text
Backlog → Ready → In Progress → In Review → Done
```

| Status | Meaning |
|--------|---------|
| **Backlog** | Defined, but not cleared for pickup (open questions, or Should/Could waiting) |
| **Ready** | Clear enough to start in an evening session without asking the PM first |
| **In Progress** | Someone is actively working; a branch usually exists |
| **In Review** | Pull request is open |
| **Done** | Merged to `main` and accepted (or closed as not doing) |

### Alignment rules

| Work | Default Status | Default Milestone |
|------|----------------|-------------------|
| Must (`[M#]`) | Ready | Sprint 1 — Foundation |
| Should (`[S#]`) | Backlog | Sprint 1 — Should |
| Could (`[C#]`) | Backlog | Sprint 1 — Could |
| New Feature | Backlog (PM moves to Ready) | Sprint 1 — Foundation unless PM says otherwise |
| Bug critical/high | Ready | Current sprint milestone |
| Bug low | Backlog | Current sprint milestone |
| Open PR | In Review | — |

**Roadmap view** on the same project shows work against milestones/time. Use it for the 15-day plan; use the **Board** for daily status.

---

## How to claim and finish work

### 1. Pick work

1. Open the [board](https://github.com/users/Mr-Macharia/projects/3) → **Board** view.  
2. Take items from **Ready** (Must first).  
3. Do not start Should/Could unless Must pace allows or the PM promotes them to Ready.

### 2. Claim

1. Comment on the issue: `Taking this`.  
2. Set Status to **In Progress**.  
3. Create a branch from latest `main`:

```text
feat/<short-name>
fix/<short-name>
docs/<short-name>
```

Examples: `feat/carer-pwa-login`, `fix/late-alert-grace`.

### 3. Implement

- Keep changes in the correct package path.  
- Rails backend work belongs under `/backend`.  
- Follow [Definition of Done](./docs/definition_of_done.md).  
- Prefer small PRs over large multi-day branches.

### 4. Open a pull request

1. Fill the **PR template** completely.  
2. Link the issue: `Closes #123` (or `Fixes #123`).  
3. Tick monorepo **Scope** checkboxes.  
4. Describe the **Best Pinnacle Care outcome** in operational language.  
5. Attach **screenshots** for any UI change (`/pwa` or `/admin-web`).  
6. Assign **Copilot** as a reviewer (Reviewers → search `copilot`).  
7. Ensure **CI** and **Secret scan** are green.  
8. Move the board card to **In Review** (or rely on project workflow if enabled).

### 5. Review gate

Before merge:

1. Copilot has reviewed; critical findings resolved.  
2. Human/PM approval when required.  
3. No secrets committed.  
4. Contracts and consumers stay in sync.

### 6. After merge

- Linked issue should move to **Done** (automatic when project workflows are on).  
- **Do not delete issues, milestones, or project history.**  
- **Do not assume branches are auto-deleted** — leave branches unless the PM asks otherwise.

---

## Features vs bugs

### Features / build tasks

- Start from acceptance criteria.  
- Update AC checkboxes on the issue as you complete them.  
- If scope grows, comment and ask the PM before expanding.

### Bugs

1. Use the **Bug** template.  
2. Set **priority** (critical = auth, missed-visit, payroll/export, data loss).  
3. Note environment: PWA / admin-web / Rails, browser/device if known.  
4. Link the original feature issue if this is a regression.  
5. Critical/high bugs may cut in front of features — PM confirms on Ready.

### Blocked

- Apply label `status:blocked`.  
- Comment: what you need, from whom, by when.  
- Leave Status as In Progress or move to Backlog only if work fully stops.

---

## Suggested build order (Must)

Work roughly in this order to avoid blocked freelancers:

1. **M3** Backend foundation (Rails) alongside **M1** / **M2** auth  
2. **M4** Shift assignment → **M5** Carer dashboard  
3. **M6** Clock in/out → **M7** Offline sync  
4. **M8** Live board → **M9** Late/missed alerts  
5. **M10** Timesheets → **M11** Export  

Should/Could only after Must is on track.

---

## Secrets and care data

- Never commit `.env`, API keys, JWT secrets, or database passwords.  
- Use `.env.example` with empty placeholders only.  
- Location and shift data are sensitive — treat production-like data carefully.

---

## What not to do

- Do not push straight to `main` if branch protection is enabled; use a PR.  
- Do not create a second GitHub Project board.  
- Do not delete issues or rewrite history to “clean up.”  
- Do not skip the PR template or Copilot review.  
- Do not change `/contracts` without a consumer plan.

---

## Project workflows (PM)

**Workflows** on the board auto-move cards (separate from GitHub Actions CI).

PM should enable under board → **⋯** → **Workflows**:

- Auto-add issues and PRs from this repo  
- Item closed → Done  
- Pull request merged → linked issues → Done  

Until enabled, freelancers and PM update Status manually.

---

## Questions

- **Product / priority / Ready:** PM (issue comment preferred).  
- **Implementation detail:** freelancers on the PR or issue.  
- **WhatsApp:** check-ins every 3–4 days and true blockers only.
