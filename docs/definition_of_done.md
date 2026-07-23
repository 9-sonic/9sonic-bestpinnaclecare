# Definition of Done — Best Pinnacle Care (15-day build)

A task is **done** only when all of the following are true:

## Product

- [ ] Every acceptance criterion on the issue is checked off or explicitly deferred with PM agreement
- [ ] Happy path works for the carer or manager persona
- [ ] Error and empty states are handled (no blank screen / silent failure)
- [ ] Offline / no-signal behaviour is handled when the work touches clocking, maps, or sync
- [ ] Client-visible behaviour matches the operational description on the issue/PR

## Engineering

- [ ] Changes live in the correct monorepo path(s)
- [ ] If the API shape changed, `/contracts` is updated **and** consumers (`/pwa`, `/admin-web`, and/or `/backend`) are updated in this PR or a linked PR
- [ ] No secrets, tokens, passwords, or `.env` files committed
- [ ] Debug noise removed (`console.log`, `debugger`, stray TODOs that block production)

## Review & quality gate

- [ ] PR template completed (scope, outcome, how to test, checklist)
- [ ] Issue linked (`Closes #` / `Fixes #`)
- [ ] **Copilot** has reviewed the PR; critical findings are resolved or explicitly accepted by PM
- [ ] Human / PM gate applied (especially for `scope:contracts`, `scope:backend`, auth, alerts, timesheets)
- [ ] UI PRs include a screenshot compared against expected carer/manager behaviour
- [ ] **CI is green** (`ci-summary` and secret scan)

## Board

- [ ] PR merged to `main`
- [ ] Linked issue moved to **Done** (automation should do this; PM verifies on the board)
