# Skill: PM environment — Gichogu Macharia

**Purpose:** Guide **Gichogu Macharia** (and Claude helping him) to improve the **collaboration environment** for Best Pinnacle Care clock-in delivery — Linear, GitHub, visibility, templates, access, automation health — **without controlling craft** owned by Athaliah, Dennis, or Ian, and without inventing backlogs or day plans.

**Use when:** Setting up tools, unblocking access, fixing board/PR mismatch, improving templates, helping someone make work visible, or auditing whether the rails still serve Sprint 1/2 iteration.

---

## Role boundary (critical)

| Gichogu **does** | Gichogu **does not** |
| --- | --- |
| Help people use Linear + GitHub as task truth | Dictate frontend technique, backend schema, or design pixels |
| Keep visibility healthy (statuses, links, views) | Become the bottleneck for every code decision |
| Unblock environments, permissions, kit install | Invent a multi-week task schedule for specialists |
| Nudge missing tickets/PRs | Mark work Done based on chat vibes alone |
| Support Jesse with board-level status facts | Replace Jesse as Best Pinnacle communicator |
| Propose process shapes when asked | Override specialist method after they chose |

**Align, don’t control** applies hardest to this role. Environment success = others can move freely **and** visibly.

---

## What “environment” means here

1. **Linear** — issues `BES-xxx`, cycles Sprint 1/2, views, labels, status honesty  
2. **GitHub** — repo access, branch protection as team agrees, PR templates, link to Linear  
3. **Claude project kit** — `.claude/` skills/context available to builders  
4. **Notion** — decisions/specs only; not the task board  
5. **Design linkage** — Figma/handoff paths usable when Athaliah needs them  
6. **Human access** — accounts, invites, secrets process (without pasting secrets into tickets)

If it helps people start work and see work, it is environment. If it chooses their algorithm, it is craft control — stop.

---

## Operating loop (continuous, not a day plan)

```text
Observe board/PRs → Spot friction → Small fix or ticket → Confirm unblocked → Leave craft alone
```

Examples of friction:

- PR open with no `BES-xxx`  
- In Progress for long stretch with no link and no blocker note  
- Client request only in chat  
- New teammate cannot clone or open Linear  
- Automation not transitioning status  
- Design ready but no implementation ticket  

---

## Concrete help patterns

### A. First-time / reset checklist (run when someone is stuck starting)

```markdown
## Environment ready? (BPC delivery)

- [ ] GitHub access to https://github.com/9-sonic/9sonic-bestpinnaclecare
- [ ] Linear access; can see BPC issues / Sprint cycle
- [ ] Knows ticket id pattern BES-xxx
- [ ] Knows branch pattern type/BES-xxx-slug
- [ ] PR template visible / knows to include ticket id
- [ ] Claude kit available in workspace (CLAUDE.md, skills, context)
- [ ] Knows who to ping: Jesse (client), Gichogu (rails), Athaliah (UX), Dennis (FE), Ian (BE)
- [ ] Notion location for decisions (if team uses it) — not for daily tasks
```

Turn gaps into **environment tickets** if they take real work — don’t only verbalise.

### B. Board health glance (lightweight)

Ask only:

1. What is In Progress — does each have an owner?  
2. Which In Progress items lack PR/branch links for code work?  
3. Any client-request items waiting on Jesse without label/clarity?  
4. Any trust-risk bugs parked with no owner?  
5. Are Sprint 1/2 cycles used coarsely (not micro-scheduled)?  

Then **nudge with questions**, not reassignments of method:

> “BES-118 is In Progress — is there a PR to link, or are you blocked on something I can help with?”

### C. Linear ↔ GitHub linkage help

- Ensure repo integration is connected when the team wants automation  
- Teach: branch/PR title contains `BES-xxx`  
- If automation fails: manual status still required; fix automation as chore ticket  
- Never require Notion task duplication  

### D. Making uncertain work visible

When someone says “I might work on offline next”:

1. Help them write an **outcome ticket** (use `uncertain-work` + `issue-handling` templates).  
2. Do **not** expand into ten speculative tickets.  
3. Do **not** order their implementation steps.  

### E. Supporting Jesse with facts

Provide board-level bullets Jesse can trust:

- What’s In Review (PR links)  
- What’s blocked and on whom  
- Open client questions listed on tickets  
- No commentary that invents completion percentage theatre  

### F. Supporting Athaliah / Dennis / Ian

| Need | Gichogu help | Not Gichogu |
| --- | --- | --- |
| Athaliah | Ticket for design work; handoff visibility; Figma access | Drawing the UI for them |
| Dennis | Env vars process, PR template, linking API tickets | Choosing component library unilaterally |
| Ian | Staging access, secrets path, webhook config help | Designing the domain model for them |

---

## Templates Gichogu can paste

### Environment / access issue

```markdown
Title: [Env] …

## Who is blocked
## What they need to do but can’t
## Systems
## Ideal outcome
## Temporary workaround (if any)
```

### Visibility nudge (comment)

```markdown
Noticing BES-… is In Progress without a linked PR.
- If you’re still exploring: a short comment on what’s open helps Jesse/me see reality.
- If you have a branch: link it when you can.
- If blocked on rails (access/tools): tag me with what “unblocked” looks like.
No change requested to your approach — only visibility.
```

### Automation health chore

```markdown
Title: [Env] Repair Linear↔GitHub status automation
## Expected
PR open → In Review; merge → Done (or team-agreed mapping)
## Actual
## Impact on visibility
```

---

## What good PM environment help looks like

- Dennis opens a PR faster because access and template were ready  
- Jesse answers Best Pinnacle from board truth, not guesswork  
- Athaliah’s handoff sits on a ticket Dennis can find  
- Ian’s contract note is linked, not lost  
- Nobody feels managed-by-ticket-microplan  
- Sprint language stays Sprint 1 / Sprint 2, not hourly  

---

## Anti-patterns (stop immediately)

- Writing a day-by-day plan for the team “to help”  
- Inventing backlog items to make the board look full  
- Dictating CSS, SQL, or Figma structure as PM mandate  
- Using Notion as the real task system  
- Private status knowledge only Gichogu holds  
- Closing client policy questions without Jesse  
- Measuring people by story-point theatre this kit doesn’t use  
- Blocking merge on personal preference unrelated to visibility/risk process  

---

## When Claude helps Gichogu

Claude should:

- Draft checklists, nudges, env tickets  
- Audit a pasted board/PR list for visibility gaps  
- Remind flexibility and role boundaries  
- Point to other skills (`issue-handling`, `pr-and-review`, `client-comms-jesse`)  

Claude should not:

- Generate fake velocity reports as truth  
- Assign implementation methods to specialists  
- Expand scope into platform modules  
- Pretend to have live Linear access if it doesn’t  

---

## Success definition for this skill

The environment is working when **any teammate** can answer:

1. What am I trying to make true? → Linear outcome  
2. Where is the change? → GitHub PR when code  
3. Who do I need? → named handoff  
4. What’s still open with the client? → Jesse-visible questions  
5. Am I free to choose craft? → yes  

Gichogu’s craft **is** that environment. Protect it without becoming the product’s second brain for code.
