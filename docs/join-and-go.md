# Join and go — Best Pinnacle Care

**One page for anyone joining the delivery rails.**  
Team invites and Figma happen later; when your access lands, follow this and start.

| Truth | Tool |
|-------|------|
| Code & PRs | [GitHub](https://github.com/9-sonic/9sonic-bestpinnaclecare) |
| Status | Linear team **BES** — [Best Pinnacle](https://linear.app/best-pinnacle/team/BES) |
| Knowledge | Notion **Engineering Hub** (ask PM for share link) |

Product name may say **BPC**. Linear issue ids are always **`BES-xxx`**.

---

## Before access (optional)

You can still prepare:

1. Install Git, your editor, and Claude or Cursor.
2. Read this page and [dual-board.md](./dual-board.md).
3. Skim monorepo map: Rails at **repo root**, carer app `client/pwa`, manager app `client/admin-web`.
4. Wait for PM to invite you to **GitHub Write**, **Linear BES**, and **Notion Engineering Hub**.

---

## Day-one checklist (30 minutes after invites)

### 1. Confirm access (5 min)

- [ ] Open the [repo](https://github.com/9-sonic/9sonic-bestpinnaclecare) — you can see code and open a PR.
- [ ] Open Linear team **Best Pinnacle** — open cycle **Sprint 1** (Must work is **Todo** in the cycle).
- [ ] Open Notion Engineering Hub → **Start here (engineering)** / **Join and go**.
- [ ] Clone:  
  `git clone https://github.com/9-sonic/9sonic-bestpinnaclecare.git`

### 2. Load the project brain (5 min)

- [ ] Open the repo in Claude Code or Cursor.
- [ ] Read `.claude/CLAUDE.md` and `.claude/context/team-alignment.md`.
- [ ] Skills live under `.claude/skills/` (PR path, dual boards, role handoffs).
- [ ] Optional AI tools: [mcp-setup.md](./mcp-setup.md) (Linear / Notion / GitHub MCP — **not** installed by clone).
- [ ] App boot: [local-dev.md](./local-dev.md) when you need Rails + clients running.

### 3. Notifications (5 min)

- [ ] **Linear:** Settings → Notifications — assign, mentions, digests on.
- [ ] **GitHub:** Watch this repo → Custom → PRs + mentions/reviews.

Detail: Notion page *Notification matrix* (under Engineering Hub).

### 4. First real contribution (15 min)

Pick **one** path:

| Role | First move |
|------|------------|
| **Frontend** | Linear **Sprint 1** → Todo + EPIC Shifts / Clock / Auth |
| **Backend** | Linear **Sprint 1** → Todo + EPIC Infrastructure / Auth / Clock |
| **PM / env** | Env & Tooling project; keep boards healthy |
| **CEO / Jesse** | Linear views for Must / client; do not manage commits |
| **Design** | When Figma is enabled later — use `design` label; until then, UI notes on tickets/PRs |

**How you receive work:** Must issues live in **Sprint 1**. They are not auto-assigned. Claim one (comment or assignee = you), set **In Progress**, enable notifications so assigns/mentions reach you.

Then ship:

```text
1. Claim issue in Linear (Sprint 1) → In Progress
2. git checkout -b feat/BES-<n>-short-slug
3. Small change → open PR
4. PR title/body: BES-<n> and Closes #<github> if closing an issue
5. Wait for CI + Fireworks (+ Copilot if available)
6. Merge when green (developers may merge)
7. Linear → Done when merged (manual until GitHub integration is on)
```

**Branch alone is not delivery.** Never push product work straight to `main`.

### If you “don’t see a review”

1. Confirm a **Pull Request** exists (not only a remote branch).  
2. Open the PR → **Conversation** and **Checks** (Fireworks + Template gate).  
3. Copilot may be missing (quota/plan) — Fireworks is the reliable AI lane.  
4. Full FAQ: [faq-pr-reviews.md](./faq-pr-reviews.md).

---

## Operating rules (non-negotiable)

1. **Write status once** — do not open unlinked Linear + GitHub tickets for the same work.
2. **GitHub PR = merge truth** if boards drift.
3. **Notion is knowledge**, not a task board.
4. **No day plans** — Sprint 1 build / Sprint 2 test only.
5. **Specialists own craft** — PM owns environment and visibility.
6. **Dual AI review** on PRs: Copilot (when quota allows) + **Fireworks** sticky comment.

---

## Must path (demo) — where work lives

| EPIC (Linear) | Must tickets |
|---------------|--------------|
| Auth & Access | BES-5 M1, BES-6 M2 |
| Infrastructure | BES-7 M3 |
| Shifts & Dashboard | BES-8 M4, BES-9 M5 |
| Clock & Offline | BES-10 M6, BES-11 M7 |
| Monitoring | BES-12 M8, BES-13 M9 |
| Timesheets | BES-14 M10, BES-15 M11 |

Full table: [dual-board.md](./dual-board.md).

---

## If something is missing

| Problem | Who |
|---------|-----|
| No GitHub / Linear / Notion access | **Gichogu (PM)** |
| Ready queue empty or unclear | PM |
| CI / Fireworks / secrets | PM |
| Product priority / client | **Jesse** |
| API / data | **Ian** (backend) |
| UI implementation | **Dennis** (frontend) |
| Design system / Figma | **Athaliah** — Figma join later |

---

## Definition of Done (short)

- Outcome on the ticket is true in the product or environment.
- PR merged with `BES-xxx` linked (if code).
- Linear **Done**.
- Leftover risk filed as a **new** ticket, not lost in chat.

---

## PM: invite someone later (copy-paste)

When you grant access, send:

```text
Welcome to Best Pinnacle Care delivery.

1) Accept invites: GitHub (9sonic-bestpinnaclecare), Linear team Best Pinnacle (BES), Notion Engineering Hub
2) Open: https://github.com/9-sonic/9sonic-bestpinnaclecare/blob/main/docs/join-and-go.md
3) Clone, open in Claude/Cursor, filter Linear Ready, take one BES ticket
4) Branch feat/BES-n-… → PR with BES-n → merge when green

Notion Start here (engineering) is the knowledge front door.
Figma comes later — skip design tooling for now.
```

---

## Related links

| Doc | Why |
|-----|-----|
| [CONTRIBUTING.md](../CONTRIBUTING.md) | Full process |
| [dual-board.md](./dual-board.md) | BES ↔ GitHub map |
| [builder-environment.md](./builder-environment.md) | What’s live on rails |
| Linear Start here | Project **Best Pinnacle** document |
| Notion Engineering Hub | Start here + DoD + notifications |
