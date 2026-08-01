# Local development (thin guide)

How to boot the monorepo on your machine. Collaboration process: [join-and-go.md](./join-and-go.md). Stack: [tech-stack.md](./tech-stack.md).

## Layout

| Path | App |
|------|-----|
| Repo root | Rails 8 API (`Gemfile`, `bin/rails`, `app/`) |
| `client/pwa` | Carer PWA |
| `client/admin-web` | Manager admin web |

## Prerequisites

- Git, and Write access to the repo  
- **Ruby** matching `.ruby-version` (if present) or the version in CI  
- **Bundler**, **PostgreSQL** (local or Docker)  
- **Node.js** (LTS) for clients when `package.json` exists under `client/*`  

## Rails API (root)

```bash
cd /path/to/9sonic-bestpinnaclecare
bundle install
# Create .env / credentials per team convention — never commit secrets
bin/rails db:prepare   # or db:create db:migrate
bin/rails server
```

Default local URL is typically `http://localhost:3000` (confirm in logs).

Check:

```bash
bin/rails about
bin/rails routes | head
```

## Clients

```bash
cd client/pwa          # or client/admin-web
# if package.json exists:
npm install            # or pnpm / yarn if the app uses them
npm run dev            # or the script named in package.json
```

Point the client API base URL at your local Rails server (see app env sample / README under each client when present).

## API contract

If you change the API shape (regenerate the OpenAPI doc under `swagger/`), update Rails and the affected client in the same PR (or a clearly linked pair of PRs).

## Shipping changes

Local success is not delivery. Open a PR into `main` with `BES-n` and/or `Closes #n`.  
See [CONTRIBUTING.md](../CONTRIBUTING.md).

## If something is missing

| Problem | Who |
|---------|-----|
| Wrong Ruby / DB access | Backend lead / PM env |
| Client scripts not defined yet | Frontend lead — scaffold may still be thin |
| Secrets for staging/prod | PM / backend — never in git |

This page stays thin on purpose. Prefer app-local README files as they appear under `client/*` and root.
