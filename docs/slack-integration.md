# Slack Integration Architecture & Event Routing Matrix

> **Product:** Best Pinnacle Care (9Sonic)  
> **Repo:** https://github.com/9-sonic/9sonic-bestpinnaclecare  
> **Tickets:** Linear `BES-xxx`  

This document details the event-driven architecture connecting **GitHub**, **Linear**, **Notion**, and **CI/CD Actions** to **Slack**, defining exact routing rules so the team stays focused without channel noise.

---

## 1. Architecture Overview

```
[ GitHub Repo ] ──────────┐
(PRs, Commits, CI)        │
                          ▼
[ Linear BES ] ─────► [ SLACK WORKSPACE ] ◄───── [ Notion Specs ]
(Tasks, Cycles)      (9Sonic Engineering)       (ADRs, Handbook)
                          ▲
[ GitHub Actions ] ───────┘
(CI Build Failure Webhooks)
```

---

## 2. Channel Routing Matrix

| Event Source | Trigger Event | Destination Slack Channel | Urgency / Action |
|---|---|---|---|
| **GitHub** | PR Opened / Requested Review | `#bpc-prs` | Medium — Reviewer assigned |
| **GitHub** | PR Merged to `main` | `#bpc-prs` | Info — Updates status |
| **Linear** | Ticket status -> `In Review` | `#bpc-linear-updates` | Info — PR attached |
| **Linear** | Ticket status -> `Done` | `#bpc-linear-updates` | Info — Feature landed |
| **Linear** | Ticket status -> `Blocked` | `#bpc-alerts` | **High** — Requires PM/Lead intervention |
| **Linear** | P1 Urgent issue created | `#bpc-alerts` | **High** — Immediate triage required |
| **Linear** | Sprint Cycle Started/Ended | `#bpc-announcements` | Info — Sprint progress summary |
| **GitHub Actions** | Main build failure / test crash | `#bpc-alerts` | **Critical** — Trunk broken |
| **Notion** | New ADR added to Decision Log | `#bpc-spec-updates` | Info — Architecture decision accepted |

### Who delivers each row

| Delivered by | Rows |
|---|---|
| **This repo's workflows** ([slack-pr-notify.yml](../.github/workflows/slack-pr-notify.yml), [slack-issue-notify.yml](../.github/workflows/slack-issue-notify.yml), the alert step in [ci.yml](../.github/workflows/ci.yml)) | PR opened/merged, urgent or blocked GitHub issues, CI failure on `main` |
| **Linear for Slack** (configured in Linear, no repo code) | All Linear rows |
| **Notion for Slack** (configured in Notion, no repo code) | The Notion row |

Only the first group is code we maintain. If a Linear or Notion row is not
firing, the fix is in that tool's settings — not in this repository.

---

## 3. Webhook Payload Examples

### GitHub Action Slack Webhook (`#bpc-alerts`)
```json
{
  "text": "🚨 *CI Build Failure on main branch*",
  "blocks": [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "*Workflow Failure*: `CI / Monorepo Validation` on `main`\n*Commit*: `<https://github.com/9-sonic/9sonic-bestpinnaclecare/commit/abc1234|abc1234>`\n*Author*: @dev"
      }
    }
  ]
}
```

---

## 4. Operational Best Practices

1. **Slack is an Event Notification & Quick Chat Layer — NOT System of Record**:
   - Conversations happen in Slack; decisions land in **Notion**; work tasks land in **Linear**; code lands in **GitHub**.
2. **Do Not Cross-Post Manually**:
   - Let Linear and GitHub Slack integrations handle automated updates. Avoid copy-pasting PR links into general channels.
3. **Mute Non-Essential Channels**:
   - Developers should keep notifications enabled for `@mentions` and `#bpc-alerts`, muting ambient channels during active coding blocks.
