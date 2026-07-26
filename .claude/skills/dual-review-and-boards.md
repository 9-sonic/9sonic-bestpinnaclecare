# Skill: Dual AI review + dual boards

Use when explaining how work is tracked or reviewed in this repo.

## Code path (always)

```text
ticket → branch → PR into main → reviews + green checks → merge
```

- A **branch alone is not delivery**.
- **Never push product work straight to `main`.**
- PR template + Template gate enforce issue link (or `Process-only: true`), scope, screenshots for UI.

## Dual AI review on every PR

| Reviewer | What it is |
|----------|------------|
| **Copilot** | GitHub Copilot code review (requested by Action) |
| **Fireworks** | Sticky PR comment via Fireworks API (default model Kimi K2.7 Code; secret `FIREWORKS_API_KEY`) |

Neither replaces human/PM merge judgment. Address real findings; ignore noise with a short note on the PR.

## Dual boards (GitHub + Linear) — write once, sync

**Goal:** redundancy if one tool fails — **not** two separate backlogs.

| Board | Role |
|-------|------|
| **GitHub Issues + Project “Best Pinnacle”** | Live today; code-adjacent visibility |
| **Linear `BES-xxx`** | Team status board (team key **BES**); cycles Sprint 1 / 2 when enabled |

Product name **BPC** is fine in prose; Linear issue prefix is always **BES**.

### Rules

1. **Create a work item in one place only** (prefer Linear; GitHub Issue if Linear is down).  
2. **Link, don’t duplicate:** Linear description should link GitHub `#n` if both exist; PR body should include **`BES-xxx` and/or `Closes #n`**.  
3. **Do not** open Linear *and* GitHub issues for the same work without a link between them.  
4. If sync breaks: **GitHub PR is source of truth for merge**; fix Linear next session.  
5. Status moves via automation where possible (PR open → In Review; merge → Done) once Linear↔GitHub integration is on.

### Branch names (both accepted)

```text
feature/BES-123-short-slug    # preferred when Linear id exists
feat/short-slug               # still valid
fix/BES-123-short-slug
docs/BES-123-short-slug
```

## Repo layout (current)

- **Rails API** at repository root (`app/`, `config/`, …)  
- **Frontends:** `client/pwa`, `client/admin-web`  
- **Contracts / docs:** `contracts/`, `docs/`  
- **Claude rails:** `.claude/` (this tree)

When suggesting paths, prefer this layout over older monorepo sketches that only used top-level `/pwa` and `/backend`.
