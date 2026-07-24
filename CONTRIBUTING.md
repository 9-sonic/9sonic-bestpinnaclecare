# Contributing — Best Pinnacle Care (9Sonic)

This monorepo is the only place product work for the 15-day Best Pinnacle Care build is tracked and merged. GitHub is the source of truth. WhatsApp is for check-ins every 3–4 days and real blockers — not for status that belongs on the board.

**Board:** [Best Pinnacle](https://github.com/orgs/9-sonic/projects/1)  
**Repo:** https://github.com/9-sonic/9sonic-bestpinnaclecare  

---

## Roles

| Role | Responsibility |
|------|----------------|
| **PM** | Priority, Ready queue, operational answers, final PR gate, board health |
| **Developers** | Implement features and bugs, open PRs, respond to Copilot and review comments |
| **Copilot** | First review on every PR. Auto-requested by the **Request Copilot review** Action on open/push; if missing, assign under Reviewers → `copilot` |

The PM does not implement application code. Developers own `/pwa`, `/admin-web`, and `/backend` (Rails).

---

## Monorepo map

| Path | Purpose |
|------|---------|
| `/pwa` | Carer mobile PWA |
| `/admin-web` | Manager website |
| `/backend` | **Ruby on Rails** API and jobs |
| `/contracts` | Shared API shapes between apps |
| `/docs` | Process, backlog, delivery notes |

See [docs/tech-stack.md](./docs/tech-stack.md). **Do not open a second repository for this build.**

### Contracts rule

If a PR changes `/contracts` without updating the consumers (`/pwa`, `/admin-web`, and/or `/backend`), it is incomplete. State which PR completes the handshake.

---

## Types of work

| Type | When | Template |
|------|------|----------|
| **Build Task** | Planned deliverable with acceptance criteria | Build Task |
| **Feature** | New capability not already filed as `[M#]` / `[S#]` / `[C#]` | Feature |
| **Bug** | Incorrect or broken behaviour | Bug |

Backlog stories `[M1]`–`[M11]`, `[S12]`–`[S16]`, `[C17]`–`[C20]` already exist. Prefer them over duplicates.

### Labels (minimum on every issue)

- One **`scope:*`**: `scope:pwa` · `scope:admin-web` · `scope:backend` · `scope:contracts` · `scope:docs`  
- One **`type:*`**: `type:feature` · `type:bug` · `type:debt`  
- One **`priority:*`** when known: `priority:critical` · `priority:high` · `priority:low`  
- **`sprint:build`** (or `sprint:test` in the test window)  
- **`client:best-pinnacle-care`** for client-visible work  
- MoSCoW when relevant: `moscow:must` · `moscow:should` · `moscow:could`  

---

## Board lifecycle

```text
Backlog → Ready → In Progress → In Review → Done
```

| Status | Meaning |
|--------|---------|
| **Backlog** | Defined but not released for pickup |
| **Ready** | Clear enough to start without unanswered product questions |
| **In Progress** | Actively being built; branch usually exists |
| **In Review** | PR open |
| **Done** | Merged to `main` and accepted (or closed as not doing) |

### Default alignment

| Work | Status | Milestone |
|------|--------|-----------|
| Must `[M#]` | Ready | Sprint 1 — Foundation |
| Should `[S#]` | Backlog | Sprint 1 — Should |
| Could `[C#]` | Backlog | Sprint 1 — Could |
| New Feature | Backlog until PM marks Ready | Sprint 1 — Foundation (unless stated otherwise) |
| Bug critical / high | Ready | Current sprint milestone |
| Bug low | Backlog | Current sprint milestone |
| Open PR | In Review | — |

Use the **Board** for status and the **Roadmap** for plan vs milestones. Same cards, different views. **Work type** on the project: Feature · Bug · Chore.

---

## Claim → ship

**Creating a branch is not delivery.** A branch is only where you build. Work is not done until you **open a pull request into `main`**, get reviews (Copilot / Fireworks), pass checks, and **merge**. Pushing a branch alone does not land code, close the issue, or run the review gates.

```text
Issue (Ready) → claim → branch from main → implement → open PR → reviews + green checks → merge → Done
```

### 1. Pick

1. Open [Best Pinnacle](https://github.com/orgs/9-sonic/projects/1) → **Board**.  
2. Take from **Ready** (Must first).  
3. Do not start Should/Could unless Must is on track or the PM has promoted the card to Ready.

### 2. Claim

1. Comment on the issue: `Taking this`.  
2. Set Status to **In Progress**.  
3. Branch from latest `main`:

```text
feat/<short-name>
fix/<short-name>
docs/<short-name>
```

### 3. Implement

- Stay in the correct package path.  
- Rails work only under `/backend`.  
- Meet [Definition of Done](./docs/definition_of_done.md).  
- Prefer small PRs (open the PR within 24–48 hours of starting; do not sit on a long-lived branch with no PR).

### 4. Pull request (required)

1. Open a PR from your branch **into `main`** — this is mandatory for any change that should ship.  
2. Complete the PR template.  
3. Link the issue: `Closes #123` or `Fixes #123`.  
4. Tick monorepo **Scope**.  
5. Describe the **Best Pinnacle Care outcome** in operational language (not only code jargon).  
6. Screenshots required for UI (`/pwa` or `/admin-web`).  
7. Confirm **Copilot** is a reviewer (workflow should request it on open and on each push to the PR; assign manually if missing).  
8. Read **Fireworks AI** review comment when that workflow is enabled (secret `FIREWORKS_API_KEY`).  
9. Keep **CI summary** and **Secret scan** green (and **Template gate** when that check is on `main`).  
10. Set board Status to **In Review**.

Draft PRs are fine while you polish; mark **Ready for review** when you want full automation and review.

### 5. Review gate (before merge)

1. Copilot has reviewed; critical findings resolved.  
2. Fireworks (if configured) findings addressed or explained.  
3. PM / human approval when required.  
4. No secrets committed.  
5. Contracts and consumers aligned.

### 6. After merge

- Linked issue moves to **Done** (by automation when enabled, otherwise update the board).  
- Do not delete issues, milestones, or project history.  
- Branches are not auto-deleted.

### FAQ

| Question | Answer |
|----------|--------|
| I created a branch — is that enough? | **No.** Open a PR into `main`. |
| Can I push straight to `main`? | **No.** Always use a PR (process rule; later enforced with GitHub Pro). |
| When do I open the PR? | As soon as there is something reviewable — ideally within **24–48 hours**, not only at the end of a large branch. |
| What closes the issue? | Merge a PR that says `Closes #N` (or Fixes/Resolves). |
| Who reviews first? | **Copilot** (and **Fireworks** when the API key is set); then PM/human for the gate. |

---

## Features vs bugs

### Features / build tasks

- Work from acceptance criteria; tick them off on the issue.  
- Scope growth needs a comment and PM agreement before expanding.

### Bugs

1. Use the **Bug** template.  
2. Set priority (`priority:critical` for auth, missed-visit/alerts, payroll/export, data loss/security).  
3. Note surface: PWA / admin-web / Rails, and device/browser if known.  
4. Link the related feature issue if this is a regression.  
5. Critical/high bugs may jump the queue — they go to **Ready**.

### Blocked

- Label `status:blocked`.  
- Comment: what is needed, from whom.  
- Keep Status accurate (In Progress if partially active; otherwise leave context on the issue).

---

## Must build order

1. **M3** Rails foundation with **M1** / **M2** auth  
2. **M4** shifts → **M5** carer dashboard  
3. **M6** clock in/out → **M7** offline sync  
4. **M8** live board → **M9** late/missed alerts  
5. **M10** timesheets → **M11** export  

Should/Could only when Must pace allows.

---

## Secrets and care data

- Never commit `.env`, keys, tokens, or database passwords.  
- `.env.example` may hold empty placeholders only.  
- Location and shift data are sensitive.

---

## Do not

- Push straight to `main` when protection requires a PR — always open a PR.  
- Create a second GitHub Project for this build.  
- Delete issues or rewrite history to tidy the board.  
- Skip the PR template or Copilot review.  
- Change `/contracts` without a consumer plan.

---

## Questions

| Topic | Where |
|-------|--------|
| Priority, Ready, product intent | PM — prefer an issue comment |
| Implementation | Developers on the issue/PR |
| Urgent blockers / demos | WhatsApp (3–4 day rhythm) |
