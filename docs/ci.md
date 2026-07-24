# CI and PR automation

## Checks on every pull request

| Check | Blocks merge? | Purpose |
|-------|---------------|---------|
| **Template gate** (PR hygiene) | **Yes** (red if incomplete) | Requires linked issue (or `Process-only: true`), monorepo scope, screenshot for UI paths |
| **CI summary** | Treat as required | Layout hygiene + package checks when code exists |
| **Secret scan** (Gitleaks CLI) | Treat as required | Fail if secrets look committed |
| **Request Copilot review** | Process yes | Requests Copilot on open / every push to the PR |
| **Path labels** | No | Adds `scope:*` labels from changed paths |
| **Project board sync** | No | Linked issues → **In Review** on PR; → **Done** on merge |
| **Fireworks AI review** | No | Sticky AI review comment via Fireworks API |
| **Main push guard** | No (warn only) | Flags direct pushes to `main` that are not PR merges |

Draft PRs skip most gates until marked ready.

## Template gate rules

The **Template gate** job fails when:

1. Body has no `Closes #N` / `Fixes #N` / `Resolves #N`, **and** body does not contain `Process-only: true`  
2. Body has no monorepo scope mention (`/pwa`, `/admin-web`, `/backend`, `/contracts`, `/docs`)  
3. Diff touches `pwa/` or `admin-web/` and body has no screenshot (markdown image or GitHub attachment)

Pure docs/workflow PRs may use:

```text
Process-only: true
```

## Path labels

Configured in `.github/labeler.yml`. Labels are **added** only (never removed by the bot).

## Board sync (Best Pinnacle)

Workflow `project-board-sync` updates [org project #1](https://github.com/orgs/9-sonic/projects/1).

- Needs permission to write org project fields.  
- If default `GITHUB_TOKEN` cannot write the project, add repository secret **`PROJECT_TOKEN`**: a PAT with access to this repo and the org project.  
- Failures are warnings only — they do not fail the PR.

## Fireworks AI code review

Workflow: `.github/workflows/fireworks-pr-review.yml`

- **Base URL:** `https://api.fireworks.ai/inference/v1`  
- **Default model:** `accounts/fireworks/models/kimi-k2p7-code`  
- **Secret:** `FIREWORKS_API_KEY`  
- **Optional variable:** `FIREWORKS_MODEL`  

On each non-draft PR open/push, posts or updates a sticky PR comment. Complements Copilot; does not replace the PM merge gate.

If the secret is missing, the job comments that it was skipped and does **not** fail the PR.

## Package jobs (pwa / admin-web / backend / contracts)

- No `package.json` yet → pass with scaffold message.  
- When a package exists → install + run `lint` / `typecheck` or `build` / `test` if those scripts exist.

## CD (deploy)

Not enabled yet. UK hosting is issue **M3**. Use `workflow_dispatch` and repository secrets when deploy is ready — never commit secrets.

## For developers

1. Fill the PR template completely.  
2. Keep **Template gate**, **CI summary**, and **Secret scan** green.  
3. Read Copilot + Fireworks comments; fix real issues.  
4. Prefer lockfiles and standard script names (`lint`, `typecheck`, `build`, `test`).  
5. Never commit `.env` — use `.env.example` without secrets.  
6. Never push straight to `main` — always open a PR.
