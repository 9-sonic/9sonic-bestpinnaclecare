# Tech stack expectations

This document states **what freelancers should assume**. It does **not** ship application code. Code arrives only via pull requests.

## Monorepo

| Path | Stack expectation | Owner focus |
|------|-------------------|-------------|
| `/pwa` | Carer progressive web app (frontend; framework chosen by FE freelancer / agreed with PM) | FE |
| `/admin-web` | Manager web app (frontend; same or related stack as PWA unless agreed otherwise) | FE |
| `/backend` | **Ruby on Rails** API, jobs, auth, alerts, timesheets | BE |
| `/contracts` | Shared API contracts (OpenAPI, JSON Schema, or shared types — freelancers introduce format) | FE + BE |
| `/docs` | Process and product notes | PM + team |

## Backend (Rails)

- All server-side work for Best Pinnacle Care lives under **`/backend`** as a **Ruby on Rails** application.  
- UK hosting, encryption, backups, and audit trail are tracked as issue **[M3]**.  
- Secrets stay out of git; use environment variables / platform secrets at deploy time.

## Frontends

- Carer experience → `/pwa` (offline clock-in is a Must — design for poor signal).  
- Manager experience → `/admin-web` (live board, timesheets, exports).  
- Exact JS framework is not locked in this process-only setup; freelancers propose in the first frontend PR if not already decided with the PM.

## Contracts

- `/contracts` is the handshake between PWA, admin-web, and Rails.  
- Changing request/response shapes without updating all consumers is a **PM red flag**.

## CI

- GitHub Actions run hygiene, secret scan, and path-aware checks when packages appear.  
- Freelancers should keep **CI green** on every PR.

## Out of scope for the empty monorepo

- No Gemfile, Rails app, or frontend scaffold is pre-generated in this preparation pass.  
- Freelancers scaffold Rails under `/backend` and frontends under `/pwa` and `/admin-web` through normal PRs linked to issues.
