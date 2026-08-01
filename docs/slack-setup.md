# Slack Workspace & Integration Setup Guide: 9Sonic (Best Pinnacle Care)

> **Purpose:** Step-by-step guide for setting up Slack as the real-time notification, communication, and alert layer for 9Sonic engineering builds, integrated with **GitHub**, **Linear**, **Notion**, and **CI/CD webhooks**.

---

## 1. Workspace Architecture & Channel Layout

To prevent notification spam while keeping team members informed during 15-day sprint cycles, establish the following Slack channels:

| Channel Name | Visibility | Primary Purpose | Integrated Tools |
|---|---|---|---|
| `#bpc-announcements` | Public | High-level project updates, cycle goals, client releases | Linear (Cycle events), Manual |
| `#bpc-prs` | Public | PR review requests, approvals | GitHub for Slack |
| `#bpc-linear-updates` | Public | Task movements (`In Progress` -> `In Review` -> `Done`), blocker alerts | Linear for Slack |
| `#bpc-alerts` | Public | Production/P1 bugs, CI build failures, security alerts | GitHub Actions / Webhooks |
| `#bpc-spec-updates` | Public | Notion ADR decisions, spec changes, handbook updates | Notion for Slack |
| `#bpc-dev` | Public | General technical discussions, developer Q&A, ambient chat | Ephemeral / Manual |

---

## 2. Integrating GitHub with Slack

### Step 1: Install the GitHub Slack App
1. In Slack, click **Add apps** from the sidebar or visit `https://slack.github.com/`.
2. Install the **GitHub** app to your 9Sonic workspace.
3. Authorize the GitHub app to access the `9-sonic` GitHub organization.

### Step 2: Subscribe Channels to Repository Events
In your `#bpc-prs` Slack channel, run the following slash command:
```bash
/github subscribe 9-sonic/9sonic-bestpinnaclecare reviews, pulls, commits, releases
```

### Step 3: Configure PR Review Reminders
1. Open the repository `9-sonic/9sonic-bestpinnaclecare` on GitHub.
2. Navigate to **Settings > Scheduled reminders**.
3. Add a Slack workspace scheduled reminder for pending PR reviews targeted to `#bpc-prs` every weekday at 10:00 AM.

---

## 3. Integrating Linear with Slack

### Step 1: Connect Linear Workspace to Slack
1. Open Linear -> **Settings > Integrations > Slack**.
2. Click **Connect Slack** and grant permission for the 9Sonic workspace.

### Step 2: Map Linear Team `BES` / `BPC` to Slack Channels
1. In Linear, navigate to **Team Settings (BES) > Integrations > Slack**.
2. Set up channel notifications:
   - **`#bpc-linear-updates`**: Sync issue status changes (when tickets move to `In Review`, `Done`, or `Blocked`).
   - **`#bpc-alerts`**: Notify immediately when any issue is created with `Priority: Urgent (P1)` or `status:blocked`.
   - **`#bpc-announcements`**: Send a digest on Cycle start and completion.

### Step 3: Slash Commands & Personal Notifications
- Team members can create Linear issues directly from Slack messages:
  - Hover over a message -> click `...` -> **Create Linear Issue**, or type `/linear create`.
- Enable personal Linear bot notifications for `@mentions` and issue assignments in Slack.

---

## 4. Integrating Notion with Slack

### Step 1: Connect Notion to Slack
1. Open Notion -> **Settings & Members > My integrations / Connections**.
2. Add **Slack** connection and authorize the 9Sonic workspace.

### Step 2: Page & Database Subscriptions
1. Open the **Decision Log (ADR)** database in Notion.
2. Click `...` in the top right -> **Slack notifications**.
3. Select `#bpc-spec-updates` to receive alerts whenever a new ADR is accepted or updated.

---

## 5. Webhook Setup for CI/CD & Build Alerts

For automated workflow notifications (e.g. GitHub Action pipeline failures):

1. Go to **Slack > Settings & Administration > Manage apps > Custom Integrations > Incoming Webhooks**.
2. Click **Add to Slack** and choose the channel `#bpc-alerts`.
3. Copy the generated Webhook URL (format: `https://hooks.slack.com/services/T.../B.../X...`).
4. Store this URL as a GitHub Repository Secret (**Settings → Secrets and variables → Actions**).

### Which secret goes where

**One incoming webhook posts to exactly one channel.** The routing matrix in
[slack-integration.md](./slack-integration.md) therefore needs two of them:

| Secret | Bound to | Used by |
|--------|----------|---------|
| `SLACK_ALERTS_WEBHOOK_URL` | `#bpc-alerts` | CI failure on `main`, urgent/blocked issues |
| `SLACK_WEBHOOK_URL` | `#bpc-prs` | Ordinary PR opened / merged notices |

Both are optional. **A workflow with no webhook configured logs a skip and stays
green** — it never fails a PR. Set the alerts webhook first; it carries the
messages that actually need someone to react.

### Avoiding double-posting

Step 2 above subscribes `#bpc-prs` to PR traffic through the **GitHub for Slack**
app, and `slack-pr-notify.yml` posts PR notices too. Pick one:

- **Recommended:** keep `/github subscribe` for ambient PR and commit traffic and
  leave `SLACK_WEBHOOK_URL` **unset**. The PR workflow then stays quiet.
- Or skip `/github subscribe` for `pulls` and set `SLACK_WEBHOOK_URL` so the
  workflow owns PR notices (richer formatting, contract-aware).
