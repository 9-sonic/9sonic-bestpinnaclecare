# Office web app

What the office uses to run the day: who is on shift, who is late, who is
covering which visit, and whether the week's hours are right.

Separate from the carer PWA in `../pwa` on purpose. See "Why two apps" below.

## Running it

```bash
npm install
npm run start
```

Opens on http://localhost:5174. The carer app uses 5173, so both can run
together.

Demo mode is on by default (`VITE_USE_MOCK=true` in `.env`), which serves
sample data shaped exactly like the API's. Set it to false and point
`VITE_API_BASE_URL` at Rails to use the real thing.

## Why two apps rather than one

The two audiences share a backend and almost nothing else.

- **Different identities.** The API has separate `admins` and `employees`
  tables with separate login endpoints. An admin token is not a carer token.
  Shipping both apps together would mean shipping admin code to every carer's
  phone, which is a larger attack surface for no benefit.
- **Different devices.** Carers use a phone one-handed, outdoors, often with no
  signal. The office uses a desktop with a connection and wants density: a whole
  day's rota on one screen.
- **Different failure modes.** The carer app must work offline, so it caches
  aggressively. The office app must never show a stale rota, so it caches
  nothing. Those are opposite requirements and awkward to hold in one codebase.
- **It is what the repo already assumed.** `docs/tech-stack.md` lists
  `/admin-web` as the manager web app.

They share the design tokens, so the two look like one product.

## Screens

| Route | What it is for |
|---|---|
| `/login` | Admin sign in, with the TOTP second step |
| `/` | Today at a glance: counts, what needs attention |
| `/board` | Live board, every visit today and its state |
| `/rota` | Week view, publish visits, assign carers |
| `/employees` | Staff list, invite, activate and deactivate |
| `/service-users` | People receiving care, addresses, geofence settings |
| `/exceptions` | Visits needing a decision, plus open alerts |
| `/timesheets` | Periods, approval and lock |

## Permissions

The API has five admin roles: `registered_manager`, `manager`, `coordinator`,
`finance` and `auditor`. Employee and admin management is restricted server side
to the first three. The UI hides what a role cannot do, but the server is the
thing enforcing it: hiding a button is a courtesy, not a control.
