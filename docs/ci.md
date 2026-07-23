# CI / CD notes

## What runs today

| Workflow | When | Purpose |
|----------|------|---------|
| **CI** (`.github/workflows/ci.yml`) | Every PR and every push to `main` | Path-aware package checks + always-on summary |
| **Secret scan** (`.github/workflows/secret-scan.yml`) | Every PR and push to `main` | Fail if secrets/keys look committed |

### Package jobs (pwa / admin-web / backend / contracts)

- If the package has **no** `package.json` yet → job **passes** with a scaffold message (repo is ready for freelancers to add code).
- When a `package.json` appears, the job will:
  - Detect npm / pnpm / yarn from lockfiles
  - Install dependencies
  - Run `lint`, `typecheck` or `build`, and `test` **if those scripts exist**

### Required check

Branch protection should require **`CI summary`** (job id `ci-summary`).  
Do not require path-filtered jobs alone — skipped required checks can block merges.

## CD (deploy)

Live deploy pipelines are **not** enabled yet. Backend UK hosting is product issue **M3**.

When ready, add a `workflow_dispatch` deploy workflow and inject secrets via GitHub Actions secrets (never commit them).

## Local tips for freelancers

1. Keep scripts named `lint`, `typecheck`/`build`, and `test` so CI picks them up automatically.
2. Prefer lockfiles (`package-lock.json`, `pnpm-lock.yaml`, or `yarn.lock`).
3. Never commit `.env` — use `.env.example` without secrets.
