# CI and PR automation

## Checks on every pull request

| Check | Blocks? | Purpose |
|-------|---------|---------|
| **CI summary** | Treat as required | Layout hygiene + package checks when code exists |
| **Secret scan** (Gitleaks CLI) | Treat as required | Fail if secrets look committed |
| **Request Copilot review** | Process yes | Requests Copilot on open / every push to the PR |
| **PR hygiene** | Comment / gate depending on branch | Template reminders (and fail gate if that PR is merged) |
| **Fireworks AI review** | No | Sticky AI review comment via Fireworks API |

Draft PRs skip review workflows until marked ready.

## Fireworks AI code review

Workflow: `.github/workflows/fireworks-pr-review.yml`

Uses Fireworks’ OpenAI-compatible API:

- **Base URL:** `https://api.fireworks.ai/inference/v1`  
- **Default model:** `accounts/fireworks/models/kimi-k2p7-code`  
- **Secret:** `FIREWORKS_API_KEY` (Settings → Secrets and variables → Actions)  
- **Optional variable:** `FIREWORKS_MODEL` to override the model id  

On each non-draft PR open/push:

1. Collect the PR diff  
2. Call Fireworks `chat/completions`  
3. Create or update a sticky PR comment with the review  

If the secret is missing, the job comments that it was skipped and does **not** fail the PR.  
Complements Copilot; does not replace the PM merge gate.

### Popular model ids (set via `FIREWORKS_MODEL` if desired)

- `accounts/fireworks/models/kimi-k2p7-code` (default)  
- `accounts/fireworks/models/llama-v3p3-70b-instruct`  
- `accounts/fireworks/models/qwen2p5-coder-32b-instruct`  
- `accounts/fireworks/models/deepseek-v3`  

## Package jobs (pwa / admin-web / backend / contracts)

- No `package.json` yet → pass with scaffold message.  
- When a package exists → install + run `lint` / `typecheck` or `build` / `test` if those scripts exist.

## CD (deploy)

Not enabled yet. UK hosting is issue **M3**. Use `workflow_dispatch` and repository secrets when deploy is ready — never commit secrets.

## For developers

1. Fill the PR template.  
2. Keep CI and secret scan green.  
3. Read Copilot + Fireworks comments; fix real issues.  
4. Never commit `.env` — use `.env.example` without secrets.
