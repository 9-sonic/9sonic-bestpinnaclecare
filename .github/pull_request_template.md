## What this PR does
(one-line)

## Linked issue
Closes #

## Scope
- [ ] `client/pwa` (carer)
- [ ] `client/admin-web` (manager)
- [ ] Rails API (repo root: `app/`, `config/`, …)
- [ ] `/contracts`
- [ ] `/docs` / `.github` / process

## What Best Pinnacle Care outcome does this change?
Describe the carer or manager experience, not only the code.

Example: "Carer can now clock in while offline; the record syncs automatically when signal returns."

## How to test
1. ...
2. ...

## Checklist
- [ ] Acceptance criteria on the linked issue are met
- [ ] Happy path + error/empty states handled
- [ ] Offline state handled (if clocking/maps)
- [ ] I have updated `/contracts` if the API shape changed
- [ ] I have tested the offline clock-in flow (if applicable)
- [ ] I have tested the manager alert flow (if applicable)
- [ ] I have removed all `console.log` / debug code
- [ ] Copilot review requested / auto-assigned
- [ ] Human / PM review requested
- [ ] CI green
- [ ] No secrets / keys committed
- [ ] Screenshot attached for any UI change (required for `client/pwa` or `client/admin-web`)

## Review notes
- Copilot flagged anything critical? (paste link to comment)
- Any breaking changes to timesheet or alert logic?
- If `scope:contracts`: which consumer PR completes the handshake?
