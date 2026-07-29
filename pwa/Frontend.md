# Carer PWA

The phone app carers use to see their rota, clock in and out of visits, record
what happened, and message the office.

This folder is frontend only. There is no server here. The app is a bundle of
static files that talks to the Rails API in `/backend` over HTTPS.

---

## Running it

```bash
npm install
npm run start
```

Opens on http://localhost:5173. If that port is taken Vite will pick 5174, 5175
and so on, and it will tell you which in the terminal.

Only run one dev server at a time. Two Vite processes share
`node_modules/.vite` and will corrupt each other's dependency cache. The
symptom is `Failed to fetch dynamically imported module` and a blank screen. Fix:

```bash
rm -rf node_modules/.vite && npm run dev
```

### Demo mode

Out of the box the app runs on fake data held in the browser, so you can build
and review screens without the API being ready. Any email and password signs you
in. A banner on the sign in screen says so.

When the API is live, set `VITE_USE_MOCK=false` in `.env`, point
`VITE_API_BASE_URL` at it, and delete `src/mocks/`. No screen changes.

---

## Configuration

Copy `.env.example` to `.env`. Only three values matter:

| Variable | What it does |
|---|---|
| `VITE_USE_MOCK` | `true` runs on browser fake data, `false` calls the real API |
| `VITE_API_BASE_URL` | Where the Rails API lives |
| `VITE_APP_NAME` | Name shown in the UI |

Read them through `src/config/env.js`, never `import.meta.env` directly. One
place to validate, one place to change.

**Everything in this file is public.** Vite bakes `VITE_*` values into the
JavaScript that ships to the browser, so anyone can read them in devtools. No
database credentials, no signing secrets, no private API keys. Those belong to
the Rails app and never leave the server. Database configuration in particular
has no business being here at all: the frontend never speaks to Postgres.

---

## How it is built

Vite, React 18, React Router 6, plain JavaScript. Three runtime dependencies
plus two font packages. No component library, no CSS framework, no state
management library.

That is deliberate. The UI is bespoke enough that a component library would have
been fought rather than used, and the app's state is small: who is signed in,
what theme, and whatever the current screen fetched. React context covers it.
Adding Redux or Tailwind here would be more to learn and more to maintain for no
gain. If you are tempted to add a dependency, check whether twenty lines of code
does the job first, because it usually does.

### Folder layout

```
src/
  main.jsx            Providers, fonts, service worker registration
  Root.jsx            Splash screen gate
  App.jsx             Every route, one file
  config/env.js       The only place env vars are read
  api/                One module per resource, plus the shared fetch client
  mocks/              Fake data. Delete when the API is live.
  context/            Auth, Theme, Toast
  hooks/              useAuth, useBiometric, useOnline, useInstallPrompt, useQueueSync
  routes/             ProtectedRoute
  pages/              One file per screen
  components/
    common/           Button, Card, Icon, Modal, Skeleton and friends
    layout/           AppLayout, BottomNav, SideNav, MenuDrawer
    clock/ shifts/    Feature specific pieces (Dial, Calendar, ShiftCard)
  utils/              format, geolocation, offlineQueue, haptics, storage
  styles/             variables.css (tokens), global.css (everything else)
```

### The API layer is the important part

Every network call goes through `src/api/client.js`. It owns the base URL, the
`Authorization` header, JSON encoding, and error shape. On a 401 it clears the
stored token so the app falls back to the sign in screen.

Resource modules sit on top and are the only thing screens import:

```js
// src/api/shifts.js
export function listShifts(params = {}) {
  if (env.useMock) return mock.listShifts(params);
  const qs = new URLSearchParams(params).toString();
  return api.get(`/shifts${qs ? `?${qs}` : ''}`);
}
```

That one `if` is how demo mode works. Screens call `listShifts()` and never find
out where the data came from.

**When the Swagger doc arrives, this is the only folder you touch.** Line up the
paths and payload shapes with the real endpoints and the app is wired. The
current paths (`/auth/login`, `/shifts`, `/clock/in`) are guesses based on
typical Rails conventions and should be expected to change.

Errors are always an `ApiError` with `status` and `data`. A network failure is
`status: 0`, which is how the offline queue knows the difference between "no
signal" and "the server said no".

---

## Design

The visual language comes from the supplied designs in `UI-Previews/` and the
company logo.

### Colour

Three brand colours, all from the logo: teal (the butterfly wing) carries the
interface, green (the wordmark) means done or confirmed, purple (the flourish)
marks scheduled work. Everything else is neutral.

Full ramps live in `src/styles/variables.css`. Use the semantic names
(`--color-primary`, `--color-text-muted`) in components rather than the raw
ramp values, so dark mode keeps working.

Dark mode is a `data-theme` attribute on `<html>`, applied by an inline script
in `index.html` before first paint. That script exists so a dark mode user never
gets a white flash on launch. If you add a colour, add its dark counterpart in
the same commit.

### Type

Two families with different jobs. Sora sets headings, figures and the shift
timer, because it is geometric and its numerals are even. Manrope sets body
text and labels, because it stays legible at 12px on a phone held at arm's
length in daylight. Sizes come from a token scale rather than hard-coded pixels,
which is what lets the larger text setting scale the whole app at once.

Body text is 14px. Do not go below 12px for anything a carer has to read. Half
the audience is reading this outdoors, in a hurry, possibly wearing gloves.

### Spacing and shape

4px spacing scale, generous corner radii, soft low-contrast shadows. Cards are
white on a light grey background. Buttons are pills.

### Motion

Kept to almost nothing on purpose. Anything that appears on every navigation
must not animate, because entry animations on shared chrome is exactly what
makes an app feel like it is flickering. The bottom bar and page content have no
transitions at all. Motion is reserved for things the user just summoned, like a
dialog sliding up or a toast appearing.

Two rules worth knowing because both were bugs at one point:

- Do not key the content wrapper on the route. It tears down and rebuilds the
  whole tree on every navigation, and the tab bar visibly repaints.
- The tab bar carries `contain: layout paint` so a route change cannot cause it
  to repaint.

---

## Navigation

Five tabs at the bottom on phones: Home, Shifts, Clock (the raised centre
button), Messages, Profile. On screens 900px and wider the tab bar is replaced
by a sidebar.

Not everything fits in five tabs, so the hamburger on Home opens a drawer with
every destination grouped under Work, Account and Support. Anything reachable in
the app should be reachable from there.

| Route | Screen |
|---|---|
| `/login`, `/forgot-password` | Sign in, password reset request |
| `/home` | Greeting, hours progress, stat tiles, next visit |
| `/clock` | Shift timer with break, GPS capture |
| `/shifts`, `/shifts/:id` | Month calendar and visit lists, care plan and notes |
| `/overview` | Weekly chart, recent clock ins |
| `/timesheet` | Estimated pay and entries |
| `/notifications` | Rota changes, messages, reminders |
| `/messages`, `/messages/:id` | Conversations and chat |
| `/profile` and `/profile/*` | Account, personal details, availability, preferences |
| `/help` | Contact number and common questions |
| `/navigate/:id` | Route map, hands off to the phone's map app |

Screens are code split with `lazyWithRetry`, which retries a failed chunk
download twice before reloading. Chunk fetches fail for reasons that have
nothing to do with your code, mainly flaky mobile signal and deploys replacing
the files an open tab was built against. Without the retry the carer lands on an
error screen mid shift.

---

## Offline

Offline clock in is a Must for this project, so it is handled properly rather
than hoped for.

The service worker precaches the app shell. API reads are network first with a
cache fallback. The part that matters:

**If a clock in or out fails because the phone has no signal, the event is
queued in `localStorage` with the real timestamp and GPS fix, then replayed when
the connection returns.** Payroll sees the moment the carer tapped the button,
not the moment the phone found a bar of signal. Getting this wrong means people
are paid incorrectly.

A strip at the top of the screen tells the carer they are offline, and how many
events are still waiting to sync. `useQueueSync` does the replaying.

---

## Device features

| Feature | Used for | If unavailable |
|---|---|---|
| WebAuthn | Face ID, fingerprint or Windows Hello sign in | Falls back to the password form |
| Geolocation | Position fix when clocking in and out | Clocking still works, no fix recorded |
| Vibration | Confirmation buzz on clock actions | Silently ignored, which is what iOS does |
| Service worker | Offline shell and update prompt | App works, online only |
| `beforeinstallprompt` | Install to home screen | iOS gets a sheet with manual steps |

Location is captured at the moment of clocking and nowhere else. The app does
not track anyone between visits, and the Help screen says so in those words,
because carers ask.

Nothing here is required. Every one of these degrades to a working app, which is
the point: a carer with an older Android phone must still be able to do their
job.

---

## Accessibility

Not a polish item. The audience includes people with older eyes, in bad light,
in a hurry.

- Touch targets are 44px minimum. Verified across every screen, including the
  toggles, which use an invisible padded hit area so the visible switch can stay
  small.
- Larger text setting in Preferences scales the root font size, and because
  every size is a rem off that root, the whole interface grows together.
- Inputs are at least 16px, otherwise iOS Safari zooms the page when a field is
  focused and the layout jumps.
- Safe area insets are respected top and bottom for notched iPhones.
- `prefers-reduced-motion` disables animation.
- Icon-only buttons carry `aria-label`. Toggles are real `role="switch"`
  buttons. Dialogs trap focus, close on Escape, and hand focus back where it was.
- The calendar reads dates out properly, for example "Monday 15 May, 2 shifts",
  rather than announcing a bare number.

If you add a control, check it against this list before opening the PR.

---

## Adding a screen

1. Component in `src/pages/`.
2. If it needs data, add the call to the matching `src/api/` module, with a mock
   branch so it works in demo mode.
3. Lazy import and route in `src/App.jsx`.
4. If it should be in the menu, add it to `SECTIONS` in
   `components/layout/MenuDrawer.jsx`.
5. Styles at the bottom of `global.css` under a comment for that screen. Use
   tokens, not raw values.

Reuse `ScreenHeader`, `Card`, `Button`, `EmptyState` and `Skeleton` rather than
rolling new ones. Loading states use `Skeleton` shaped like the real content, so
nothing jumps when data lands.

---

## Conventions

Small things that keep the codebase consistent:

- Components read env through `config/env.js`, storage through
  `utils/storage.js`, and dates through `utils/format.js`. Do not reach past
  them.
- No inline `style` for anything a class can do. Layout in CSS, in `global.css`.
- Class names are BEM-ish: `.shift-card`, `.shift-card__name`,
  `.shift-card--completed`.
- Comments explain why, not what. `// Monday first offset: JS getDay() is
  Sunday first` earns its place. `// set the state` does not.
- Copy is plain English, sentence case, no jargon. "Clock in", not "Initiate
  shift". Error messages say what to do next.

---

## Scripts

| Command | Does |
|---|---|
| `npm run start` or `npm run dev` | Dev server |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | ESLint |

`dist/` is static. It can be served by anything: Nginx, S3, Netlify, the Rails
app itself. It needs one rule, that unknown paths fall back to `index.html`, or
refreshing on `/shifts` will 404.

---

## Known gaps

Honest list of what is not finished:

- API paths in `src/api/` are guesses and will change when the Swagger doc lands.
- The map on `/navigate/:id` is a drawn placeholder. Real turn by turn hands off
  to the phone's map app. Dropping in Mapbox or Google Maps later does not
  affect the surrounding layout.
- PWA icons are a placeholder SVG. Real 192px and 512px PNGs are needed before
  release, listed in `vite.config.js`.
- Timesheet pay figures are estimates from mock rates. Real rates come from the
  backend.
- No test suite yet.
