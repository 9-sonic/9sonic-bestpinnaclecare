# Definition of Done — Best Pinnacle Care (15-day build)

Work is **done** only when all of the following are true.

## Product

- [ ] Every acceptance criterion on the issue is checked off or explicitly deferred with agreement on the issue
- [ ] Happy path works for the carer or manager
- [ ] Error and empty states are handled (no blank screen / silent failure)
- [ ] Offline / no-signal behaviour is handled when the work touches clocking, maps, or sync
- [ ] Client-visible behaviour matches the operational description on the issue/PR

## Engineering

- [ ] Changes live in the correct monorepo path(s)
- [ ] If the API shape changed, the OpenAPI doc under `swagger/` is regenerated **and** consumers (`/pwa`, `/admin-web`, and/or `/backend`) are updated in this PR or a linked PR
- [ ] No secrets, tokens, passwords, or `.env` files committed
- [ ] Debug noise removed (`console.log`, `debugger`, stray TODOs that block production)

## Review & quality gate

- [ ] PR template completed (scope, outcome, how to test, checklist)
- [ ] Issue linked (`Closes #` / `Fixes #`)
- [ ] **Copilot** has reviewed the PR; critical findings are resolved or explicitly accepted
- [ ] Human / PM gate applied (especially for `scope:backend`, auth, alerts, timesheets)
- [ ] UI PRs include a screenshot of the carer/manager screen
- [ ] **CI is green** (`CI summary` and secret scan)

## Board

- [ ] Work was delivered via a **pull request** into `main` (not a branch-only push)
- [ ] PR merged to `main`
- [ ] Linked issue is **Done** on the Best Pinnacle board
