# Tech stack expectations

What this monorepo assumes. Code lands only through pull requests into `main`.

## Layout (canonical)

| Path | Expectation | Focus |
|------|-------------|--------|
| `/` (repo root) | **Ruby on Rails** API — auth, shifts, clocking, timesheets, jobs | BE |
| `client/pwa` | Carer progressive web app | FE |
| `client/admin-web` | Manager web app (live board, timesheets, export) | FE |
| `contracts/` | Shared API contracts (OpenAPI, schema, or shared types) | FE + BE |
| `docs/` | Process and product notes | PM + team |
| `.claude/` | AI assistant project brain | Everyone using Claude/Cursor |

Legacy names `/pwa`, `/admin-web`, `/backend` in older notes map to `client/pwa`, `client/admin-web`, and Rails at root.

## Backend (Rails)

- Server-side work lives in the **root Rails app**.  
- UK hosting, encryption, backups, and audit trail are issue **M3** / **BES-7**.  
- Secrets never live in git (use host env / GitHub Actions secrets).

## Frontends

- Carer → `client/pwa` (offline clock-in is Must).  
- Manager → `client/admin-web`.  
- Framework and package manager details live with the app under each `client/*` folder.

## Contracts

`contracts/` (when present) is the handshake between PWA, admin-web, and Rails. Shape changes need consumer updates in the same change set or a clearly linked PR.

## CI & review

GitHub Actions: hygiene, secret scan, path labels, template gate, Copilot request, **Fireworks** quality review. Keep PRs green. See [ci.md](./ci.md) and [fireworks-review.md](./fireworks-review.md).

## Scaffolding

Rails and client trees exist on `main` and grow via issue-linked PRs. Do not invent a second repository for this product.
