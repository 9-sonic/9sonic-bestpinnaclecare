# Tech stack expectations

What this monorepo assumes. Code lands only through pull requests.

## Layout

| Path | Expectation | Focus |
|------|-------------|--------|
| `/pwa` | Carer progressive web app (frontend) | FE |
| `/admin-web` | Manager web app (frontend) | FE |
| `/backend` | **Ruby on Rails** API, jobs, auth, alerts, timesheets | BE |
| `/contracts` | Shared API contracts (OpenAPI, schema, or shared types — format chosen in implementation PRs) | FE + BE |
| `/docs` | Process and product notes | PM + team |

## Backend (Rails)

- All server-side work for Best Pinnacle Care lives under **`/backend`** as a **Rails** app.  
- UK hosting, encryption, backups, and audit trail are issue **[M3]**.  
- Secrets never live in git.

## Frontends

- Carer → `/pwa` (offline clock-in is Must).  
- Manager → `/admin-web` (live board, timesheets, export).  
- Frontend framework is agreed in the first FE PRs if not already fixed with the PM.

## Contracts

`/contracts` is the handshake between PWA, admin-web, and Rails. Shape changes need consumer updates in the same change set or a clearly linked PR.

## CI

GitHub Actions run hygiene, secret scanning, and package checks as code appears. PRs stay green.

## Scaffolding

There is no pre-generated Rails or frontend app in the empty folders. Developers introduce the Rails app under `/backend` and frontends under `/pwa` / `/admin-web` through normal issue-linked PRs.
