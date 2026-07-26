# Skill: Client communication — Jesse Ngari ↔ Best Pinnacle

**Purpose:** Help **Jesse Ngari** communicate with **Best Pinnacle Care** in plain, consistent language that matches what the team can actually deliver — without inventing scope, dates, or policy answers, and without bypassing Linear visibility.

**Use when:** Drafting updates, clarifying requests, confirming open choices, preparing sign-off language, or translating engineering uncertainty into client-safe wording.

**Not for:** Engineers freelancing commitments to the client; Claude role-playing as Best Pinnacle’s vendor of record without Jesse’s voice.

---

## Role clarity

| Person | Client-facing role |
| --- | --- |
| **Jesse Ngari** | Primary communicator with Best Pinnacle; owns promises and confirmations |
| Rest of team | Provide accurate internal status, options, and risks **to Jesse** |
| Claude | Draft, structure, stress-test clarity; never invent client agreements |

If someone else must speak to the client, Jesse still owns the narrative consistency.

---

## Shared story (always align to this)

Use this backbone so messages don’t drift:

> Carers clock in and out with a simple tap on their phone. Time and location are recorded **at that moment** — not as continuous tracking. If there is no signal, the tap is saved on the phone and sent when the phone reconnects. Managers see who is on shift and what needs attention. If a time needs correcting, the original record is kept and the change is logged. The goal is reliable attendance for care operations, pay fairness, and inspection-ready history.

Do **not** expand into full care-plans/eMAR/finance modules in a clock-in status update unless Jesse explicitly wants platform-context messaging.

---

## Principles for every client message

1. **Plain language** — no internal ticket jargon unless helpful; if you cite work, translate outcomes.  
2. **Truth over theatre** — don’t claim live behaviours that are still in progress.  
3. **Separate facts / options / asks** — clients should see what is done, what is open, what you need from them.  
4. **No silent policy** — location strictness, grace periods, SMS, tablet counts are confirmations, not assumptions.  
5. **Visible internally** — client-originated work becomes `BES-xxx`; decisions worth remembering can land in Notion.  
6. **Calm tone** — care operators are busy; short sections beat long essays.  

---

## When a client request arrives

### Steps for Jesse (with Claude support)

1. **Capture their words** (email/call notes) before interpreting.  
2. **Create or update Linear** using the client-request shape (`issue-handling` / Scenario B in `uncertain-work`).  
3. **Check against product truths** — does the ask threaten offline, audit, or tracking boundaries?  
4. **Draft a confirmation reply** that restates understanding + lists choices.  
5. **Only after clarity** do Dennis/Ian/Athaliah treat policy as decided.  
6. **Close the loop** with the client when the slice ships if they expect feedback.

### Template — acknowledgement + clarity

```markdown
Subject: Re: [topic] — confirming understanding

Hi [Name],

Thank you for [raising / clarifying] [topic].

**Our understanding**
- You need: …
- So that: …

**How this fits clock in / out**
- …

**What we need from you to proceed**
1. …
2. …

**What we will not assume**
- … (e.g. strict location blocking until you choose a mode)

We’ll update you when [outcome-level milestone], and we’ll record the confirmed choices for the team.

Kind regards,
Jesse Ngari
9Sonic
```

---

## Open choices to keep visible (client decision list)

Use this checklist when Best Pinnacle has not confirmed:

| Choice | Client-friendly wording |
| --- | --- |
| Location mode | Record location only; warn if away from expected place; or require being on site to clock |
| Grace periods | How many minutes before we treat someone as late / early leave |
| Missed vs late | When a non-arrival becomes a missed shift needing urgent attention |
| Timesheet period | Weekly, fortnightly, or four-weekly export/approval rhythm |
| PIN tablets | Whether you need wall tablets and roughly how many sites |
| Manager alerts | In-system only, and whether SMS (or similar) is required |

### Template — decision request

```markdown
## Decisions that shape your clock-in setup

To configure the system for Best Pinnacle Care, please choose:

1. **Location at clock-in/out**
   - A) Record only (for review later)
   - B) Warn the carer if they appear away from the expected place
   - C) Only allow clock-in/out when location rules pass

2. **Lateness grace:** ___ minutes

3. **Timesheet period:** weekly / fortnightly / 4-weekly

4. **PIN tablets:** none / number of sites: ___

5. **Extra manager alerts (e.g. SMS):** yes / no / discuss

Until you confirm, we will keep building the core tap → record → office visibility path using reversible defaults, and we will not treat unconfirmed rules as final.
```

---

## Status updates (sprint-level, not day micromanagement)

Jesse should speak in **Sprint 1 / Sprint 2 outcomes**, not hour-by-hour engineering.

### Template — short status

```markdown
Hi [Name],

**Where we are**
- [Outcome language: e.g. Carer tap path connected to official records in our build environment / Offline save behaviour under test / Manager view showing live statuses for …]

**What this means for your team**
- …

**What we’re refining next**
- … (still outcome-level)

**Anything we need from you**
- …

**Open choices still with you**
- …

Happy to jump on a short call if useful.

Jesse
```

### Avoid in status updates

- Internal blame or specialist method debates  
- Invented go-live guarantees Claude doesn’t know are signed  
- Feature laundry lists from Stage 2 platform docs presented as “done this week”  
- Screenshots of incomplete UI presented as production-ready without caveats  

---

## Translating engineering risk for the client

| Internal risk | Client-safe framing |
| --- | --- |
| Idempotency gap | “We’re tightening behaviour so a double-tap or weak signal can’t create two records for one action.” |
| Offline queue UX unclear | “We’re making it obvious when a shift has been saved on the phone and when it has reached the office.” |
| Policy not confirmed | “We can support different location strictness — we need your preferred mode so staff messaging stays fair.” |
| Correction audit | “Manager fixes keep the original time visible for a complete history.” |

Never hide a trust issue that would mislead the client about readiness. Soften tone; don’t soften truth.

---

## What Jesse should ask the team before writing

- What is **actually** demonstrable now?  
- What is still **in review**?  
- Which `BES-xxx` items map to client-visible outcomes?  
- Any **open policy** the client might think is already decided?  
- Any **privacy** wording needed for staff handbook / location explanation?

Gichogu can help gather board/PR visibility; Athaliah/Dennis/Ian provide craft truth.

---

## Anti-patterns

- Engineers emailing Best Pinnacle new scope  
- Claude inventing “we agreed on the call” facts  
- Promising continuous GPS tracking  
- Promising full platform modules as if clock-in sprint delivery  
- Client requests only in WhatsApp with no Linear record  
- Using legalistic fear language about CQC that overclaims  
- Day-by-day plans presented as contractual delivery schedules in this kit’s voice  

---

## Claude checklist when drafting for Jesse

- [ ] Matches shared carer story  
- [ ] No invented commitments  
- [ ] Clear asks / options  
- [ ] Separates done vs open  
- [ ] Suggests Linear capture for new work  
- [ ] Flags privacy (location-at-clock only) when relevant  
- [ ] Tone suitable for a care provider operator  

Jesse’s communication is part of delivery quality: the client’s mental model must match the product truths the team protects in code.
