---
name: Bug
about: Something broken or incorrect in the Best Pinnacle Care build
title: "[bug] <One-line summary>"
labels: ["type:bug", "sprint:build", "client:best-pinnacle-care"]
assignees: ""
---

## Summary
What is wrong in one or two sentences?

## Expected behaviour
What should happen for the carer or manager?

## Actual behaviour
What happens instead?

## Steps to reproduce
1. …
2. …
3. …

## Environment
- [ ] `client/pwa` (carer)
- [ ] `client/admin-web` (manager)
- [ ] Rails API (repo root)
- Browser / device (if known):
- Build / branch / PR (if known):

## Severity
- [ ] **Critical** — auth failure, missed-visit/alerts wrong, payroll/export wrong, data loss/security  
- [ ] **High** — live board wrong, late detection wrong, major UI broken  
- [ ] **Low** — copy, polish, non-blocking UI  

Apply label: `priority:critical` / `priority:high` / `priority:low`.

## Regression?
- Related feature / issue: #
- Did this work before? Yes / No / Unknown

## Scope
- [ ] `/pwa`
- [ ] `/admin-web`
- [ ] `/backend`
- [ ] `/contracts`

## Notes / screenshots
- …
