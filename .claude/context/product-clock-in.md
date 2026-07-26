# Context: Product story — clock in / clock out

Shared narrative for humans and Claude. Use this language in tickets, PRs, UX copy drafts, and client-facing outlines (Jesse). It is **not** a backlog and **not** a technical design freeze.

---

## Why this module exists

Best Pinnacle Care needs a reliable way to know **when carers start and finish work**, even when visits happen in homes with poor signal. Attendance underpins safe operations, fair pay, and records that stand up to questions later. Clock in / clock out is the practical foundation: simple for carers, visible for the office, honest over time.

---

## The carer’s day (story)

A carer arrives for a shift. They open the app on their phone and **tap once to clock in**. At that moment the system records **time** and **location**. They do not fill a form to prove they exist. They go about care work.

Often there is **no signal**. That is normal. If they tap while offline, the phone **saves the tap** and sends it when connectivity returns. The carer should not need a workaround ritual (find Wi‑Fi, call the office to “start,” rewrite paper later as the real system).

At the end, they **tap once to clock out**. Again: time and location at that moment only.

If a carer does not use a smartphone, a **wall-mounted PIN tablet** may be offered at agreed sites — same idea: intentional clock action, recorded time, site context. Whether tablets are required is a **client choice**, not something builders invent.

### What the carer should feel

- Fast  
- Obvious when something is still only on the phone (pending sync)  
- Trustworthy — the tap mattered  
- Not watched between visits  

---

## The manager’s day (story)

Managers need a **live sense of attendance**: who is on shift, who hasn’t arrived as expected, what exceptions need a human. Late arrivals, missed shifts, and forgotten clock-outs should surface in a place built for resolution — not scatter across chats and memory.

When a manager **corrects** a time (forgotten clock-out, wrong tap), the system keeps the **original** and logs the **change** (who / what / why). The point is not punishment; it is a history you can explain to payroll, staff, or inspection conversations.

Hours for timesheets should come from clock data people can defend, then follow the period and approval rhythm Best Pinnacle chooses.

### What the manager should feel

- Oriented without chasing every carer by default  
- Able to act on exceptions  
- Confident corrections don’t erase the past  
- Clear about what the system knows vs still open policy  

---

## Product truths (short form)

1. **Intentional taps** create the attendance story.  
2. **One official record** even when networks retry.  
3. **Offline is normal**, not an edge case.  
4. **Corrections append history**; they don’t silently rewrite it.  
5. **Location only at clock moments** — never continuous tracking.  
6. **Office visibility** is grounded in real events.  
7. **Business strictness** (grace, location mode, alerts, tablets, timesheet period) is confirmed with Best Pinnacle via **Jesse Ngari** — not guessed in code.

Full engineering conventions: `skills/clock-in-conventions.md`.

---

## Privacy in one paragraph

Staff location supports verification **when clocking in or out**. It is a limited, work-related control for attendance — not a tool for watching carers between calls or in personal time. Product language, UI, and storage choices should stay consistent with that promise.

---

## What this story is not

- Not a commitment to deliver the entire multi-module care platform in the clock-in kit  
- Not a day plan or ordered feature list  
- Not permission to hard-code unconfirmed client policy  
- Not a claim that every automation (SMS ladders, etc.) is already chosen  

When implementation details differ, **keep the human story true**. If code cannot yet keep a part of the story, say so on the ticket and in client updates — do not perform the story in marketing while the product lies.

---

## How teammates use this file

| Person | Use |
| --- | --- |
| Jesse | Align client wording to this story |
| Gichogu | Check that visible work still serves these outcomes |
| Athaliah | Design states that match carer/manager moments |
| Dennis | UI honesty (pending vs synced, clear actions) |
| Ian | Record honesty (dedupe, audit, delayed sync) |
| Claude | Refuse advice that breaks the story |

This is the product’s north star for clock-in delivery: **simple taps, honest records, fair visibility, proportionate location, human corrections you can explain.**
