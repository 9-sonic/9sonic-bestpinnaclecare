# GitHub Setup Guide: 9Sonic Build for Best Pinnacle Care

> **Purpose:** You are a first-time project manager with no prior PM experience. You are not writing code on this build. You own coordination. The two freelancers on this 15-day build have day jobs, variable availability, and they are already informally moving the backend. Your only reliable rhythm is a WhatsApp call every 3–4 days plus lightweight written updates. GitHub is therefore your single source of truth. This guide gives you exact clicks, exact checkboxes, and exact words to paste. Every choice below is designed to replace “trust me” updates with visible, enforceable process that a non-coder can operate.

---

## 1. Monorepo Layout

You are using one repository, not three. With two freelancers who context-switch after their day jobs, asking them to juggle a separate repo for the PWA, another for the admin web app, and another for the backend is a guaranteed synchronization failure. A monorepo means one branch protection rule, one Copilot review pool, one Projects board, and one set of labels. Most importantly, it forces the backend developer—who has already started informally—to bring their existing code into `main` through the same pull-request gate as everything else.

Create the repository `9sonic-bestpinnaclecare` and initialize it with a `README.md`. Then create these top-level folders:

```
9sonic-bestpinnaclecare/
├── /pwa                 # Carer mobile PWA: offline-first clock-in/out, GPS capture, shift dashboard
├── /admin-web           # Manager website: live board, late/missed alerts, timesheet approval, CSV export
├── /backend             # API and automation: shift scheduling, alert engine, timesheet calculation, SMS escalation
├── /swagger             # Generated OpenAPI — the API contract between PWA, admin-web, and backend (served at /api-docs)
└── /docs                # UI/UX screenshots, CQC audit notes, operational runbooks, and this setup guide
```

**Why this matters to you:** the API contract is your non-coder superpower. It is the generated OpenAPI document under `/swagger` (served at `/api-docs`) — the handshake between the carer app and the manager dashboard. If a pull request changes `/swagger` but does not change `/pwa` or `/backend`, that is a red flag. The frontend and backend are no longer in agreement on what a “shift” or a “clock-out” looks like. You do not need to read the code to catch this; you only need to read the file list in the PR.

---

## 2. Trunk-Based Branch Strategy

You will use **trunk-based development**. There is no `develop` branch. There are no long-lived feature branches. `main` is the only permanent branch.

**Why:** This build is fifteen calendar days long. On day eight, a branch that was opened on day three is a merge-conflict time bomb. Because the backend has already started informally, trunk-based development forces that existing code into `main` through a pull request right now, so Copilot can review it and the board can track it. Developers create short-lived branches from `main`, open a PR within twenty-four to forty-eight hours, merge, and delete the branch.

Name branches like this:
- `feat/clock-in-offline-sync`
- `fix/alert-grace-period`
- `docs/cqc-audit-screenshots`

---

## 3. Branch Protection — Exact Menu Paths and Checkboxes

You must lock `main` so that no one—including administrators—can push directly to it. Every change enters through a PR, which triggers Copilot review and your human gate.

Follow these exact steps:

1. Open the repository `9sonic-bestpinnaclecare` in GitHub.
2. Click the **`Settings`** tab on the repository navigation bar (it sits to the right of `Insights`).
3. In the left-hand sidebar, under the heading **Code and automation**, click **`Branches`**.
4. To the right of the heading **Branch protection rules**, click the green button **`Add branch protection rule`**.
5. In the field **Branch name pattern**, type exactly: `main`
6. Under **Protect matching branches**, check the following boxes in this order:
   - **`Require a pull request before merging`**
     - Under this section, check **`Require approvals`** and set the number to `1`.
     - Check **`Dismiss stale pull request approvals when new commits are pushed`**.
   - **`Require conversation resolution before merging`**
   - **`Include administrators`**
7. Leave **`Allow force pushes`** unchecked.
8. Leave **`Allow deletions`** unchecked.
9. Click the green **`Create`** button at the bottom of the page.

**Why each checkbox protects you:**
- **Require a pull request before merging:** This stops a freelancer from pushing a “quick fix” at 11 PM directly into `main` while you are asleep. It guarantees that Copilot gets a look.
- **Dismiss stale pull request approvals when new commits are pushed:** If a developer pushes new code after you or Copilot has already approved, the old approval is wiped. This prevents a bait-and-switch where the approved code is replaced by something unreviewed.
- **Require conversation resolution before merging:** If you ask a question on the PR—such as “Does this change the offline clock-in flow for carers?”—the developer cannot merge until they mark that thread resolved. It stops questions from being ignored.
- **Include administrators:** This applies the rule to you and anyone else with admin rights. On a small team, admins are the most likely to accidentally push directly out of habit. This checkbox removes that escape hatch.

---

## 4. GitHub Projects Board and Built-In Automation

Because you do not run daily standups, the board must move itself. You will use GitHub Projects as a live dashboard that updates without you dragging cards manually.

### Creating the Board

1. On the repository page, click the **`Projects`** tab.
2. Click **`Link a project`**, then select **`New project`**.
3. In the template selector, choose **`Board`**.
4. Name the project exactly: `9Sonic Build — Best Pinnacle Care`
5. Click **`Create`**.

### Columns to Create

After creation, you will see default columns. Customize them to match your 3–4 day check-in rhythm by clicking the **`+`** next to the rightmost column and selecting the appropriate status for each:

- **`Backlog`** — Work defined but not started.
- **`Ready`** — Issue is described well enough that a freelancer can pick it up during their evening without asking you questions.
- **`In Progress`** — Developer has opened a branch.
- **`In Review`** — PR is open and Copilot is assigned.
- **`Done`** — Merged to `main` and accepted by you.

### Enabling Built-In Automation

1. In the board view, click the **`...`** (three dots) menu in the top-right corner.
2. Select **`Workflows`**.
3. Enable the following built-in automations by toggling each one on:
   - **`Auto-add to project`**: Configure this to add `Issues` and `Pull requests` from the repository `9sonic-bestpinnaclecare`. Set new issues to land in **`Backlog`** and new pull requests to land in **`In Review`**.
   - **`Item closed`**: Set this to move items to **`Done`** when they are closed.
   - **`Pull request merged`**: Set this to move linked issues to **`Done`** when their pull request merges.

**Why this matters:** When a freelancer merges a PR at 10 PM on a Tuesday, the linked issue moves to `Done` automatically. When you open the board for your Thursday WhatsApp call, you see the real state of the build without asking “What did you finish?”

---

## 5. Labels to Create

Labels are your filtering language. Because you are not reading code, you read labels to decide what needs your attention.

Create these exact labels in your repository. Navigate to the repository main page, click **`Issues`**, then click **`Labels`**, then click **`New label`**. Use the names exactly as written:

| Label | Color suggestion | Purpose |
|---|---|---|
| `scope:pwa` | `#0052CC` | Carer mobile app changes (offline clock-in, GPS, PIN tablet). |
| `scope:admin-web` | `#0052CC` | Manager dashboard changes (live board, timesheet export). |
| `scope:backend` | `#0052CC` | API and automation changes (alerts, shift logic, SMS). |
| `scope:docs` | `#666666` | CQC notes, UI screenshots, runbooks. |
| `priority:critical` | `#B60205` | Missed-visit alert logic, payroll export bugs, auth failures. |
| `priority:high` | `#D93F0B` | Late-visit detection, live board crashes. |
| `priority:low` | `#FEF2C0` | Copy tweaks, non-blocking UI polish. |
| `type:bug` | `#D93F0B` | Something broken in the 15-day build. |
| `type:feature` | `#0E8A16` | New capability for Best Pinnacle Care. |
| `type:debt` | `#666666` | Refactor, test coverage, or cleanup. |
| `status:blocked` | `#000000` | Waiting on the project sponsor, client, or an asset. |
| `client:best-pinnacle-care` | `#5319E7` | All client-visible work. |
| `sprint:build` | `#C2E0C6` | Days 1–15. |
| `sprint:test` | `#C2E0C6` | Days 16–22. |
| `copilot:reviewed` | `#BFD4F2` | Copilot has finished its review. |
| `copilot:issues-found` | `#FF7619` | Copilot flagged a concern; human must resolve before merge. |
| `needs:pm-approval` | `#F9D0C4` | Waiting for your final non-coder gate. |

**Watch for API-shape drift:** If a freelancer changes the shape of a “shift” or “clock-out” object in the API (the `/swagger` OpenAPI doc) but does not update the carer PWA or the manager dashboard, the two front-ends will disagree with the backend. You catch this by seeing a PR that touches `/swagger` (or the Rails API) with no matching `/pwa` or `/admin-web` change. You then ask: “Which front-end PR consumes this new contract?”

---

## 6. Issue and Pull Request Templates

Templates force the freelancers to explain their work in operational terms—not in code jargon—so you can verify it against the Best Pinnacle Care requirements.

### Issue Template

Navigate to the repository, click **`Add file`**, then **`Create new file`**. Name the file exactly: `.github/ISSUE_TEMPLATE/build-task.md`. Paste the following block into the file:

```markdown
---
name: Build Task
about: A concrete deliverable for the 9Sonic build
title: "[scope] <One-line summary>"
labels: ["sprint:build"]
assignees: ""
---

## Context
What operational requirement from Best Pinnacle Care does this address?
Example: "Managers need to see a late-visit alert on the live board within 2 minutes of grace expiry."

## Acceptance Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Affected Monorepo Paths
- `/backend/...`
- `/pwa/...`
- `/admin-web/...`
- `/swagger/...`

## Client Visibility
Does this change the carer flow, the manager live board, or the CQC audit trail?

## Linked PR
Once opened, paste the PR number here: #
```

### Pull Request Template

Create a second file exactly named `.github/pull_request_template.md`. Paste the following block:

```markdown
## Linked Issue
Fixes #

## Scope
- [ ] /pwa
- [ ] /admin-web
- [ ] /backend
- [ ] /docs

## What Best Pinnacle Care outcome does this change?
Describe the carer or manager experience, not the code.
Example: "Carer can now clock in while offline; the record syncs automatically when signal returns."

## Checklist
- [ ] I have regenerated the OpenAPI/Swagger doc if the API shape changed.
- [ ] I have tested the offline clock-in flow (if applicable).
- [ ] I have tested the manager alert flow (if applicable).
- [ ] I have removed all `console.log` / debug code.
- [ ] I have assigned `@copilot` for review.
- [ ] I have attached a screenshot for any UI change (required because you are doing UI/UX).

## PM Review Notes
- Copilot flagged anything critical? (Paste link to comment)
- Any breaking changes to the timesheet or alert logic?
```

**Why screenshots are mandatory:** You are doing the UI/UX with no design experience. Your wireframes and reference screenshots live in `/docs`. When a developer opens a PR that touches `/pwa` or `/admin-web`, the template forces them to paste a screenshot of the actual screen. You compare that screenshot to your `/docs` reference. You do not need to understand CSS to see that a button is missing or the “Clock Out” label is wrong.

---

## 7. Copilot Code Review Enablement on GitHub Pro

You are paying for Copilot Pro so that an AI reviewer acts as your first line of defense before you apply your human gate. You need two mechanisms: automatic assignment on every PR, and a manual fallback.

### Auto-Request via Repository Ruleset

1. On the repository page, click the **`Settings`** tab.
2. In the left-hand sidebar, under **Code and automation**, click **`Rules`**.
3. Click the **`Rulesets`** tab.
4. Click the green **`New ruleset`** button, then select **`New branch ruleset`**.
5. In the **Name** field, type: `Auto-request Copilot review`
6. Under **Target branches**, click **`Add target`**, then select **`Include default branch`** (this targets `main`).
7. Under **Rules**, expand the section **`Pull requests`**.
8. Check **`Require pull request before merging`**.
9. Under that, check **`Request pull request review from Copilot`**.
10. Click **`Create`** at the top right.

From this point forward, every PR targeting `main` will automatically invite Copilot to review.

### Manual Assignment Method

If a developer opens a PR before the ruleset is active, or if Copilot somehow drops off, assign it manually:

1. Open the pull request.
2. In the right-hand sidebar, click **`Reviewers`**.
3. Click the search field labeled **`Search or request a review`**.
4. Type exactly: `copilot`
5. Select **`Copilot`** (it will appear with the Copilot icon).
6. Click outside the dropdown to confirm.

---

## 8. What You, the Non-Coder PM, Look for in Copilot Comments

You are not reading code for syntax. You are reading Copilot’s comments as a **process, consistency, and risk gate**. Here is exactly what to hunt for:

- **Contract drift:** If Copilot writes anything like “The new field in the API (`/swagger`) is not used in `/pwa` or `/admin-web`,” stop the merge. Ask the developer: “Which front-end PR consumes this contract change?” The API is the glue between the carer app and the manager dashboard; drift here breaks the whole Clock In / Clock Out flow.
- **Security keywords:** Look for the words `hardcoded`, `token`, `password`, `API key`, `injection`, or `exposure`. Best Pinnacle Care handles carer location data and shift records. A hardcoded SMS gateway key or an exposed database string is a CQC data-security failure. Treat any security comment as a block.
- **Error handling around offline logic:** The carer app must work in no-signal homes. If Copilot flags an `unhandled promise rejection`, `missing catch`, or `no fallback` on the clock-in sync path, block the merge. A crashed app in a carer’s pocket during a domiciliary visit is an operational blackout.
- **Missing test coverage:** If Copilot notes that “No tests were added for the new late-visit alert logic,” check the PR size. On a 15-day build, you may accept light coverage if the feature is UI-only, but for `/backend` alert automations—especially the missed-visit escalation flow—demand that the developer explain how they verified it.
- **Debug code left behind:** If Copilot highlights `console.log`, `debugger`, or `TODO` in the diff, require cleanup before merge. You do not want a manager’s live board printing debug messages in production.
- **PR size warnings:** If Copilot says “This PR is large” or changes more than twelve files, be suspicious. On a compressed build, large PRs hide risk. Ask the developer to split it or justify every file in the PR template.
- **Copilot’s top-level summary:** Read Copilot’s first comment. If it begins with “This PR looks good” or minor suggestions, proceed to your human checks. If it begins with “This PR introduces potential issues” or “I have concerns,” treat it as a red light until the developer replies to each concern.

**Your rule:** If the PR has the label `scope:backend` (or touches the API shape under `/swagger`), and Copilot has not commented, you do not approve. The ruleset should auto-assign, but if it fails, manually assign `@copilot` and wait.

---

## 9. Your Quality Gate Routine

When a developer drops a PR link in WhatsApp, do not just reply “LGTM.” Run this exact routine:

1. **Open the PR.** Verify the description uses the template and links to an issue (`Fixes #123`). If the template is empty, reject it immediately with the comment: “Please fill out the PR template. I need the scope checkboxes and the screenshot.”
2. **Check labels.** Ensure there is a `scope:` label and a `sprint:` label. If the PR touches the API shape (`/swagger`), verify that `/pwa` or `/backend` is also checked in the template.
3. **Verify Copilot is assigned.** Look in the **Reviewers** box. If Copilot is missing, assign `@copilot` and wait.
4. **Read Copilot’s summary.** If it flags issues, click into each comment. Look for the keywords listed in Section 8. If Copilot found issues, apply the label `copilot:issues-found` and do not merge.
5. **Check for screenshots on UI PRs.** If `/pwa` or `/admin-web` is checked and there is no screenshot, comment: “Please attach a screenshot of the carer/manager screen so I can compare against the wireframe in `/docs`.”
6. **Approve only when clean.** If Copilot is clean, the template is complete, and any screenshots match your `/docs` reference, click **`Approve`** and apply the label `needs:pm-approval`. Then merge if you are the one merging, or tell the developer they may merge.

---

## 10. Summary Checklist

Use this to verify your setup before the freelancers start pushing code:

- [ ] Monorepo folders `/pwa`, `/admin-web`, `/backend`, `/docs` exist in `main`.
- [ ] Branch protection rule on `main` created via **Settings → Branches → Add branch protection rule** with `Require a pull request before merging`, `Dismiss stale pull request approvals`, `Require conversation resolution`, and `Include administrators` all checked.
- [ ] Ruleset **Auto-request Copilot review** created via **Settings → Rules → Rulesets → New branch ruleset** with `Request pull request review from Copilot` enabled.
- [ ] GitHub Project board `9Sonic Build — Best Pinnacle Care` created with columns `Backlog`, `Ready`, `In Progress`, `In Review`, `Done`.
- [ ] Built-in automations `Auto-add to project`, `Item closed`, and `Pull request merged` enabled via the board `...` → `Workflows`.
- [ ] All eighteen labels from Section 5 created.
- [ ] Issue template `.github/ISSUE_TEMPLATE/build-task.md` and PR template `.github/pull_request_template.md` committed to `main`.
- [ ] You have personally tested the manual `@copilot` reviewer assignment on a dummy PR and know what Copilot’s comment looks like.

This setup turns GitHub into your project management backbone. It compensates for the lack of daily standups, the informal start of the backend, and the fact that you are learning PM work while shipping a care product. Every click above is there to protect Best Pinnacle Care’s carers, managers, and audit trail—by protecting your ability to see what is actually happening before it lands in `main`.