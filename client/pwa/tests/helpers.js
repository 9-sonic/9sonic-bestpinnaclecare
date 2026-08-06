import { expect } from '@playwright/test';

// Signs in through the real form. Demo mode accepts anything, so this exercises
// the actual auth path rather than injecting a token.
export async function signIn(page) {
  await page.goto('/login');
  // The passkey button is also named "sign in", so target the submit button
  // explicitly rather than by accessible name.
  await page.locator('form button[type="submit"]').click();
  await page.waitForURL(/\/home/, { timeout: 20000 });
  // Waiting for the URL alone races the first paint, so wait for the shell to
  // exist before anything measures it.
  await page.locator('.app-content').waitFor({ state: 'visible', timeout: 20000 });
}

// Every route the carer can reach, with something on each that proves the page
// actually rendered rather than falling back to an error boundary.
export const ROUTES = [
  { path: '/home', expect: '.fvisit, .home-stats' },
  { path: '/shifts', expect: '.cal' },
  { path: '/clock', expect: '.dial, .empty-state' },
  { path: '/messages', expect: '.thread-row, .empty-state' },
  { path: '/messages/301', expect: '.chat__composer' },
  { path: '/profile', expect: '.profile__name' },
  { path: '/profile/details', expect: '.detail-row' },
  { path: '/profile/availability', expect: '.avail-day' },
  { path: '/profile/preferences', expect: '.list-row' },
  { path: '/timesheet', expect: '.tsrow, .empty-state, .paysum' },
  { path: '/overview', expect: '.chart' },
  { path: '/notifications', expect: '.ncard, .empty-state' },
  { path: '/navigate/102', expect: '.map-wrap' },
  { path: '/shifts/102', expect: '.detail-hero' },
];

// Noise the test setup causes itself, rather than anything the app got wrong.
//
// serviceWorkers: 'block' in the config makes registration fail, and the app
// correctly logs that it could not register one. The log is asynchronous, so
// whether it arrives before a test finishes depends on how loaded the machine
// is: the same test passed alone and failed in a full parallel run. Ignoring it
// here is safe because the installability tests turn service workers back on
// and assert a worker really does register and activate.
const HARNESS_NOISE = [
  /\[sw\] could not register a service worker/,
  /Failed to register a ServiceWorker/i,
];

// Fails the test if anything was logged as an error or thrown while the page
// was open. Call at the start of a test and check at the end.
export function watchForErrors(page) {
  const errors = [];
  const keep = (text) => !HARNESS_NOISE.some((pattern) => pattern.test(text));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text().slice(0, 200);
    if (keep(text)) errors.push(text);
  });
  page.on('pageerror', (err) => {
    if (keep(err.message)) errors.push(`uncaught: ${err.message}`);
  });
  return errors;
}

// Nothing should ever push the page sideways on a phone.
export async function expectNoHorizontalScroll(page) {
  const overflow = await page.evaluate(() => {
    const de = document.documentElement;
    return de.scrollWidth - de.clientWidth;
  });
  expect(overflow, 'page scrolls sideways').toBeLessThanOrEqual(1);
}

// Text long enough to break a layout that assumed short database values.
export const LONG = {
  name: 'Bartholomew Fitzwilliam-Montgomery-Wallace Cholmondeley III',
  token: 'Flat4BuildingCReferenceNumberLS82XQAccessCodeSevenSevenFourNineZero',
  note: 'Medication prompt for the eight oclock blister pack, then breakfast which is porridge with honey and a cup of tea with one sugar, then personal care including a full wash and change of clothing, then check the pressure areas on both heels and the base of the spine.',
};
