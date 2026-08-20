// Guided-tour step definitions for the admin dashboard.
//
// PER-PAGE tours: each page has its own short, self-contained tour of that page's
// real controls, launched from that page (the "Show me around" navbar button, or
// the Guide's button). A tour NEVER navigates between pages — that was the old
// design and it caused the page to remount mid-tour and the popover to lose its
// anchor. Now a tour only ever runs the current page's steps.
//
// How a step works with @reactour/tour:
//  - `selector` points at a real element via a `data-tour="…"` attribute.
//  - `mutationObservables` makes reactour wait for the element to APPEAR before
//    anchoring — handles the full-screen spinner while a page loads, and makes
//    the tour role-safe (a manager-only control simply never appears for a
//    viewer, so reactour skips it).
//
// Every step just POINTS AT a visible element and describes it — no step clicks a
// button or drives a modal (that jumped the popover to the corner). Actions that
// open a modal are documented by a hover ⓘ (InfoHint) on the button instead.
//
// Steps are authored per page in TOUR_PAGES, then grouped by route into
// PAGE_TOURS at the bottom.

// Build a stable selector from an anchor name.
export const sel = (anchor) => `[data-tour="${anchor}"]`;

// Each group: { key, route, steps: [{ anchor, content, position? }] }
// `anchor` is the data-tour value; the selector is derived as [data-tour="…"].
export const TOUR_PAGES = [
  {
    key: 'liveboard',
    route: '/',
    steps: [
      {
        anchor: 'liveboard-roster',
        content:
          "This is today at a glance — everyone's visits, live. A green row means the carer is on shift; a red one means something needs you.",
      },
      {
        anchor: 'liveboard-stats',
        content:
          'These count what is happening right now — on shift, late, missed, done. Click any card to filter the list below it to just those.',
      },
      {
        anchor: 'liveboard-tabs',
        content:
          'Or use these tabs to show just one group — for example only the shifts running late.',
      },
      {
        anchor: 'liveboard-refresh',
        content:
          'The board refreshes itself every minute. If you want the very latest right now, tap here.',
      },
    ],
  },
  {
    key: 'exceptions',
    route: '/exceptions',
    steps: [
      {
        anchor: 'exceptions-tabs',
        content:
          'Exceptions has three inboxes: Exceptions (clocking problems to fix), Alerts (system warnings to clear), and Lifecycle (a record of what was escalated).',
      },
      {
        anchor: 'exceptions-queue',
        content:
          'Every clocking problem waits here — a missed visit, no clock-out, a clock-in away from the address. Click any row to open it and correct the record.',
      },
      {
        anchor: 'exceptions-filters',
        content:
          'When there are many, filter the queue by the type of problem — for example only the late arrivals.',
      },
    ],
  },
  {
    key: 'cover',
    route: '/staffing',
    steps: [
      {
        anchor: 'staffing-tabs',
        content:
          'Staffing has two tabs. Cover is for visits with no carer — you assign or offer them. Requests is where carers ask to swap, drop, do overtime or take leave, for you to approve.',
      },
      {
        anchor: 'cover-tabs',
        content:
          'On the Cover tab, these sort the unfilled visits: Unfilled, Offered (waiting for a reply), Filled, or All.',
      },
      {
        anchor: 'cover-list',
        content:
          'Click a visit here to open it. Then pick a carer from "Who can take it" and either Offer it to them, or Assign them directly. When a carer replies, you Accept or Decline on the right.',
      },
    ],
  },
  {
    key: 'requests',
    route: '/staffing',
    steps: [
      {
        anchor: 'requests-queue',
        content:
          'This is where carers ask for things — to swap or drop a shift, do overtime, change availability, or take leave. Click a request to open it.',
      },
      {
        anchor: 'requests-filters',
        content:
          'Filter the queue by what kind of request it is, or switch to Decided to see ones you have already answered.',
      },
      {
        anchor: 'requests-decision',
        content:
          'Approve or decline here, with a message to the carer. Important: this records your decision and notifies them — it does NOT move the rota for you. You make that change yourself so the record stays honest.',
      },
    ],
  },
  {
    key: 'rota',
    route: '/rota',
    steps: [
      {
        anchor: 'rota-week',
        content:
          'The rota shows one week at a time. Use these arrows to move to another week; "This week" jumps back to today.',
      },
      {
        anchor: 'rota-view',
        content:
          'See the same week grouped by carer, or by client. "By client" shows each person and the visits they are due.',
      },
      {
        anchor: 'rota-layout',
        content:
          'Grid shows the week as a spreadsheet; List shows every visit in one scrollable table, earliest first — handy for scanning or exporting a plain list.',
      },
      {
        anchor: 'rota-generate',
        content:
          'This builds next week automatically from your care packages, so you are not typing every recurring visit by hand.',
      },
      {
        anchor: 'rota-add',
        content: 'Add a one-off visit here — hover the ⓘ next to it for what to fill in.',
      },
      {
        anchor: 'rota-grid',
        content:
          'This is the week itself. LEFT-click any visit to open it — you can retime it there (a reason is required, and it is written to the audit trail).',
      },
      {
        anchor: 'rota-grid',
        content:
          'RIGHT-click any visit for quick actions: reassign or remove the carer, find cover, or cancel/delete it. Cancelling keeps the record; deleting is refused once a carer has clocked in.',
      },
    ],
  },
  {
    key: 'timesheets',
    route: '/attendance',
    steps: [
      {
        anchor: 'timesheets-period',
        content:
          'This is the CQC visit-attendance audit — every clock in and out, one row per carer x visit. Filter by date range, client or carer here, then export CSV or Excel.',
      },
      {
        anchor: 'timesheets-table',
        content:
          'These rows come straight from verified clock records — this view never changes them. To fix an actual clocked time, use a clock correction on Exceptions.',
      },
    ],
  },
  {
    key: 'clients',
    route: '/clients',
    steps: [
      {
        anchor: 'clients-toolbar',
        content:
          'Clients are the people you care for. Search for anyone by name, reference or postcode here.',
      },
      {
        anchor: 'clients-add',
        content: 'Add a new client here — hover the ⓘ next to it for what to fill in, including the geofence.',
      },
    ],
  },
  {
    key: 'employees',
    route: '/employees',
    steps: [
      {
        anchor: 'employees-tabs',
        content:
          'Employees has two lists: Staff (your carers in the field) and Admins (your office team).',
      },
      {
        anchor: 'employees-toolbar',
        content:
          'Search for a carer, or turn on "Show inactive" to include people who have left or not started yet.',
      },
      {
        anchor: 'employees-invite',
        content: 'Invite a new carer here — hover the ⓘ next to it for how the email invite works.',
      },
    ],
  },
  {
    key: 'messages',
    route: '/messages',
    steps: [
      {
        anchor: 'messages-new',
        content:
          'Messages is where the office and carers talk — direct messages, groups, or channels. Start a new one with these buttons (hover the ⓘ for what each does); your conversations are listed below — click one to open it and type at the bottom.',
      },
    ],
  },
  {
    key: 'reports-overview',
    route: '/reports',
    steps: [
      {
        anchor: 'reports-tabs',
        content:
          'Reports has four tabs: Overview (the numbers and charts you\'re looking at), Change log (every record change — clients, staff, visits, corrections — who, when and why), Sign-ins (every login attempt, with IP and device), and Exports (every download, including the CQC visit-attendance audit). Click a tab to switch.',
      },
      {
        anchor: 'reports-content',
        content:
          'This is the Overview — your clocking performance for the period you choose at the top: attendance, on-time rate and hours.',
      },
    ],
  },
  {
    key: 'guide',
    route: '/guide',
    steps: [
      {
        anchor: 'guide-states',
        content:
          'The Guide is your reference: what every shift state means, how escalation works when a clock-in is missed, and how the record is kept honest.',
      },
    ],
  },
];

// Map one authored step to what reactour consumes.
const toReactourStep = (st) => ({
  selector: sel(st.anchor),
  content: st.content,
  position: st.position,
  // reactour waits for the anchor to appear before highlighting — handles the
  // full-screen spinner while a page loads, and makes the tour role-safe (a
  // manager-only control simply never appears for a viewer).
  mutationObservables: [sel(st.anchor)],
  resizeObservables: [sel(st.anchor)],
});

// The route each page-tour belongs to. Several groups can share a route (the
// Reports tabs), so they merge into one per-page tour.
const routeForKey = {
  liveboard: '/', exceptions: '/exceptions',
  // Cover + Requests are merged under Staffing (two tabs), so their tours share
  // the /staffing route.
  cover: '/staffing', requests: '/staffing',
  rota: '/rota', timesheets: '/attendance', clients: '/clients', employees: '/employees',
  messages: '/messages', 'reports-overview': '/reports', guide: '/guide',
};

// The distinct per-page tours, keyed by route. Each is a self-contained tour of
// ONE page — no cross-page navigation, so the page never remounts mid-tour and
// the popover never loses its anchor.
export const PAGE_TOURS = TOUR_PAGES.reduce((acc, page) => {
  const route = routeForKey[page.key] ?? page.route ?? '/';
  (acc[route] ??= []).push(...page.steps.map(toReactourStep));
  return acc;
}, {});

// Steps for the page at `route` (exact path match, query stripped). Empty array
// if that page has no tour.
export const stepsForRoute = (pathname) => PAGE_TOURS[pathname] ?? [];

// Does this route have a tour to offer?
export const hasTour = (pathname) => (PAGE_TOURS[pathname]?.length ?? 0) > 0;
