# Builder environment — live rails

High-end collaboration rails for **Best Pinnacle Care** / **9Sonic**.  
Kit source (human-facing research pack): local `builder_environment/` (PM folder).  
This file is what **developers clone with the app**.

---

## Team

| Person | Role |
|--------|------|
| **Jesse Ngari** | CEO · primary voice to Best Pinnacle |
| **Gichogu Macharia** | PM · environment & visibility (not craft dictator) |
| **Athaliah Kisochi** | UI/UX · improve current design with the team |
| **Dennis Kabui** | Frontend |
| **Ian Ndegwa** | Backend (GitHub may show as **Asmadeous** — confirm mapping) |

**Align, don’t control.** No day plans. Sprint language: Sprint 1 (build) · Sprint 2 (test & refine).

---

## Tool map

| Truth | Tool |
|-------|------|
| **Code** | GitHub monorepo |
| **Status (dual)** | GitHub Issues + Project **and** Linear **`BES-xxx`** (team Best Pinnacle) |
| **Knowledge** | Notion Engineering Hub (not a task board) |
| **Design** | Figma (READY handoffs) |
| **AI in editor** | Claude / Cursor + `.claude/` skills |
| **AI on PRs** | Copilot + Fireworks |

Details: [docs/dual-board.md](./dual-board.md), `.claude/skills/dual-review-and-boards.md`, CONTRIBUTING.

---

## Dual board rules (summary)

1. **Write once** — one status change, not two unlinked tickets.  
2. **Link** Linear `BES-n` ↔ GitHub `#n` when both exist.  
3. **PRs** always carry `BES-xxx` and/or `Closes #n`.  
4. **If one tool is down**, the other still works; re-sync later.  
5. **Merge truth** is always the GitHub PR.

Linear + Notion arrangement for this product is live (epics, Ready Must path, Engineering Hub Start here / ADR log).

---

## What’s live on GitHub (verified stack)

| Rail | Status |
|------|--------|
| PR required by process | Yes (CONTRIBUTING) |
| Template gate | Yes |
| Path labels | Yes |
| Board sync (GitHub Project) | Yes (optional `PROJECT_TOKEN`) |
| Copilot request | Yes |
| Fireworks review | Yes (`FIREWORKS_API_KEY`) |
| Main push guard | Yes (warn) |
| Claude project rails | Yes (`.claude/`) |

---

## Claude / Cursor

After clone, open the repo in Claude Code or Cursor. Project guide: `.claude/CLAUDE.md`.  
Skills index: `.claude/skills/README.md`.

---

## Join and go

New people (when invites land): **[join-and-go.md](./join-and-go.md)** — day-one checklist, first PR path, PM invite blurb.  
Team access and Figma are optional later; rails work without them.

---

## Ship path

```text
Ticket (Linear and/or GitHub) → branch → PR → Copilot + Fireworks + green checks → merge → Done
```

Never: commit only on a branch with no PR, or push to `main` without a PR.

---

## Setup status (rails)

| Slice | Content | Status |
|-------|---------|--------|
| **A** | GitHub Actions, PR gates, Fireworks | **Done** |
| **B** | Linear BES, epics, Must in Sprint 1 | **Done** (GitHub OAuth still human — BES-28) |
| **C** | Notion Start here, ADR, join-and-go | **Done** (Figma later) |
| **D** | Per-machine MCP | Guide: [mcp-setup.md](./mcp-setup.md) — each person configures their client |
| **E** | Local app boot | Guide: [local-dev.md](./local-dev.md) |

External research kit: `builder_environment/` (PM folder). This repo carries the **applied** day-to-day rails.
