---
name: Build Task
about: Planned deliverable with acceptance criteria (same shape as backlog stories)
title: "[scope] <One-line summary>"
labels: ["sprint:build", "type:feature", "client:best-pinnacle-care"]
assignees: ""
---

# <Feature / task title>

**Owner:** FE / BE / design  
**Priority:** must / should / could  
**Size:** S / M / L  
**Feature tag:** clockin | maps | offline | chat | timesheets | auth | dashboard | alerts | other

## Context
What operational requirement from Best Pinnacle Care does this address?

Example: "Managers need to see a late-visit alert on the live board within 2 minutes of grace expiry."

## What
(one-line goal)

## Acceptance criteria
- [ ] Happy path works
- [ ] Error / empty state handled
- [ ] Offline / no-signal state handled (if clocking/maps)
- [ ] Criterion from product brief (add as needed)
- [ ] Meets [`docs/definition_of_done.md`](../docs/definition_of_done.md)
- [ ] PR reviewed + merged (Copilot review + human)

## Affected monorepo paths
- [ ] `client/pwa/...`
- [ ] `client/admin-web/...`
- [ ] Rails root (`app/`, `config/`, …)
- [ ] `/contracts/...`
- [ ] `/docs/...`

## Client visibility
Does this change the carer flow, the manager live board, timesheets, or the CQC audit trail?

## Notes / dependencies
- ...

## Linked PR
Once opened, paste the PR number here: #
