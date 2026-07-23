# 9Sonic — Best Pinnacle Care

Private monorepo for the **15-day Clock In / Clock Out build** for Best Pinnacle Care.

**Project board:** [Best Pinnacle](https://github.com/users/Mr-Macharia/projects/3)  
**Owner (PM):** coordination only — freelancers implement; GitHub is the single source of truth.

---

## Monorepo map

| Path | What lives here |
|------|-----------------|
| [`/pwa`](./pwa) | Carer mobile PWA — offline clock-in/out, GPS, shift dashboard |
| [`/admin-web`](./admin-web) | Manager website — live board, alerts, timesheets, export |
| [`/backend`](./backend) | API + automation — shifts, alerts, timesheets, audit |
| [`/contracts`](./contracts) | Shared TypeScript interfaces / API schemas |
| [`/docs`](./docs) | PM process, backlog, DoD, CI notes |

### Why `/contracts` matters (PM red flag)

If a PR changes `/contracts` but not `/pwa`, `/admin-web`, or `/backend`, the apps may disagree on what a “shift” or “clock-out” looks like. Ask: *Which front-end PR consumes this contract change?*

---

## How we work (trunk-based)

- **`main` is the only permanent branch.** No `develop`.
- Branch naming: `feat/…`, `fix/…`, `docs/…` (short-lived).
- Open a PR within 24–48 hours; merge; delete the branch.
- **No direct pushes to `main`** once branch protection is on.

### Work flow

1. Pick an issue from the board column **Ready** (Must items) or pull from **Backlog**.
2. Create a branch from `main`.
3. Open a PR that fills the PR template and links the issue (`Closes #N`).
4. **Copilot reviews every PR** (auto-requested when rules allow; otherwise assign Copilot manually).
5. CI must be green; fix Copilot critical findings.
6. PM/human gate: labels, screenshot for UI, contracts check → approve → merge.
7. Board moves linked issues to **Done** when the PR merges.

---

## Labels you will see

- **Scope:** `scope:pwa`, `scope:admin-web`, `scope:backend`, `scope:contracts` (red — PM attention), `scope:docs`
- **MoSCoW:** `moscow:must` / `should` / `could`
- **Priority / type / sprint / Copilot / PM:** see Issues → Labels
- **Blocked:** `status:blocked`

---

## For freelancers

1. Clone this repo; work only in the package you own unless coordinating a contracts change.
2. Use the **Build Task** issue template for new work; prefer existing backlog issues (M1–M11 first).
3. Fill the PR template completely — operational language, not only code jargon.
4. Request/confirm **Copilot** review; keep **CI green**.
5. Never commit secrets, keys, or `.env` files.

See also:

- [Definition of Done](./docs/definition_of_done.md)
- [CI notes](./docs/ci.md)
- [Product backlog](./docs/backlog.md)
- [GitHub process guide](./docs/github_setup.md)

---

## Board columns

| Column | Meaning |
|--------|---------|
| Backlog | Defined, not ready to start |
| Ready | Clear enough for an evening pickup |
| In Progress | Branch open |
| In Review | PR open |
| Done | Merged / accepted |
