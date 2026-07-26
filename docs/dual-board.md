# Dual board map — Best Pinnacle Care

**GitHub** = code & PRs · **Linear** = status (team key **BES**) · **Notion** = knowledge

Write status **once**. Link identifiers across tools. Do not treat a local branch as delivery.

## Canonical identifiers

| Tool | Key |
|------|-----|
| Linear team | **BES** (not product codename BPC) |
| Linear issues | `BES-5` … `BES-24` (Must / Should / Could) |
| GitHub issues | `#1` … (M1–M11 map roughly 1:1 with BES-5+) |
| GitHub Project | [Best Pinnacle](https://github.com/orgs/9-sonic/projects/1) |
| Repo | [9-sonic/9sonic-bestpinnaclecare](https://github.com/9-sonic/9sonic-bestpinnaclecare) |

## Must path (Ready in Linear)

| Backlog | Linear | GitHub (approx) | Linear EPIC project |
|---------|--------|-----------------|---------------------|
| M1 Carer PWA login | BES-5 | #1 | EPIC Auth & Access |
| M2 Manager login | BES-6 | #2 | EPIC Auth & Access |
| M3 Backend foundation | BES-7 | #3 | EPIC Infrastructure |
| M4 Shift assignment | BES-8 | #4 | EPIC Shifts & Dashboard |
| M5 Carer dashboard | BES-9 | #5 | EPIC Shifts & Dashboard |
| M6 Clock GPS | BES-10 | #6 | EPIC Clock & Offline |
| M7 Offline sync | BES-11 | #7 | EPIC Clock & Offline |
| M8 Live board | BES-12 | #8 | EPIC Monitoring |
| M9 Late / missed | BES-13 | #9 | EPIC Monitoring |
| M10 Timesheets | BES-14 | #10 | EPIC Timesheets |
| M11 Export CSV | BES-15 | #11 | EPIC Timesheets |

Should (S12–S16) and Could (C17–C20) remain in Linear **Backlog** under matching epics where useful.

## How to work a ticket

1. Filter Linear **Ready** (or GitHub Ready) for Must path.
2. Branch: `feat/BES-<n>-short-slug` (or `fix/` / `chore/`).
3. PR title/body: include **`BES-<n>`** and **`Closes #n`** / `Fixes #n` when closing the GitHub issue.
4. Wait for CI + Copilot + Fireworks; merge when green (developers may merge).
5. Move Linear state: In Progress → In Review → Done when the PR merges.

## Sources of truth

| Concern | Tool | Do not |
|---------|------|--------|
| Code, CI, merge | GitHub | Push to `main`; skip PR |
| Day-to-day status | Linear (BES) | Double-write unlinked GitHub + Linear tickets |
| Specs, ADRs, env log | Notion Engineering Hub | Use Notion as a task board |

## External links (human workspace)

- Linear Start here: project **Best Pinnacle** document *Start here — Best Pinnacle dual board*
- Notion: **Engineering Hub** → *Start here (engineering)*, *Environment & secrets log*, *Architecture Decision Log*, *Monorepo & dual-board map*

## Hygiene notes

- Linear onboarding issues BES-1–4 are **Canceled** (noise).
- BES-25 (duplicate M1) and BES-26 (process test) are **Canceled**.
- Product label **BPC** in older docs means the product name; Linear issue prefix is always **BES**.
