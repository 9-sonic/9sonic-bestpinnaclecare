// Every location outcome the clock screen can be in. These exist because
// getCurrentLocation() used to collapse "denied", "no signal", "timed out" and
// "still looking" into a single null, so the chip told a carer their location
// was fine while nothing had been captured — and nothing in the suite could see
// it, because none of the tests had ever failed a location request.
//
// Verification is now part of the clock tap, not of opening the screen, so
// every case here taps first and then reads the chip and the toast.

import { test, expect } from '@playwright/test';
import { signIn } from './helpers.js';

// Edith Thornbury's address in the mock data (12 Rosewood Avenue, Leeds), and a
// point plainly outside its 150m geofence. "Verified" has to mean *here*, so a
// fix that arrives from somewhere else must not earn the word.
const AT_SITE = { lat: 53.8225, lng: -1.5203 };
const MILES_AWAY = { lat: 53.44, lng: -2.25 };

// Replace navigator.geolocation before any app code runs, so each failure mode
// can be driven deterministically.
const fake = (mode) => `
  const ok = (cb) => cb({ coords: { latitude: ${AT_SITE.lat}, longitude: ${AT_SITE.lng}, accuracy: 12 } });
  const away = (cb) => cb({ coords: { latitude: ${MILES_AWAY.lat}, longitude: ${MILES_AWAY.lng}, accuracy: 12 } });
  const fail = (code) => (_s, e) => e && e({ code, message: 'test' });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: ${mode === 'none' ? 'undefined' : `{
      getCurrentPosition: ${
        mode === 'ok' ? '(s) => ok(s)'
        : mode === 'far' ? '(s) => away(s)'
        : mode === 'slow' ? '(s) => setTimeout(() => ok(s), 3000)'
        : `fail(${mode === 'denied' ? 1 : mode === 'unavailable' ? 2 : 3})`
      },
      watchPosition: () => 0, clearWatch: () => {},
    }`},
  });
`;

const CASES = [
  { mode: 'ok', tone: 'ok', match: /Verified · / },
  { mode: 'far', tone: 'warn', match: /Not verified · about [\d.]+km from the address/ },
  { mode: 'denied', tone: 'warn', match: /Not verified · location is off for this app/ },
  { mode: 'unavailable', tone: 'warn', match: /Not verified · no location signal/ },
  { mode: 'timeout', tone: 'warn', match: /Not verified · couldn't get a fix/ },
  { mode: 'none', tone: 'warn', match: /Not verified · no location signal/ },
];

const clockIn = (page) => page.getByRole('button', { name: /Clock In/i }).first();

for (const c of CASES) {
  test(`chip: ${c.mode}`, async ({ page }) => {
    await page.addInitScript(fake(c.mode));
    await signIn(page);
    await page.goto('/clock');

    const chip = page.locator('.verifychip');
    const btn = clockIn(page);
    await expect(btn).toBeVisible();

    // Nothing is said about location until the carer asks to clock in.
    await expect(chip).toHaveCount(0);

    await btn.click();
    await expect(chip).toHaveClass(new RegExp(`verifychip--${c.tone}`), { timeout: 8000 });
    await expect(chip).toHaveText(c.match);

    // The toast says the same thing as the chip, so it cannot be missed.
    await expect(page.locator('.toast')).toContainText(
      c.mode === 'ok' ? /Location verified/ : c.match
    );

    // Retry is offered exactly when the chip is amber.
    const retry = chip.locator('.verifychip__retry');
    await expect(retry).toHaveCount(c.tone === 'warn' ? 1 : 0);

    // Clocking must never be blocked by a location failure.
    await expect(clockIn(page).or(page.getByRole('button', { name: /Clock Out/i })).first())
      .toBeEnabled();
  });
}

test('opening the screen never asks for location', async ({ page }) => {
  await page.addInitScript(`
    window.__asked = 0;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (s) => { window.__asked += 1; s({ coords: { latitude: ${AT_SITE.lat}, longitude: ${AT_SITE.lng}, accuracy: 12 } }); },
      watchPosition: () => 0, clearWatch: () => {},
    }});
  `);
  await signIn(page);
  await page.goto('/clock');
  await expect(clockIn(page)).toBeVisible();
  await expect(page.locator('.verifychip')).toHaveCount(0);
  expect(await page.evaluate(() => window.__asked)).toBe(0);

  await clockIn(page).click();
  await expect(page.locator('.verifychip--ok')).toBeVisible({ timeout: 8000 });
});

test('pending is shown while looking, then resolves', async ({ page }) => {
  await page.addInitScript(fake('slow'));
  await signIn(page);
  await page.goto('/clock');
  await clockIn(page).click();
  const chip = page.locator('.verifychip');
  await expect(chip).toHaveClass(/verifychip--pending/);
  await expect(chip).toHaveText(/Checking location/);
  await expect(chip).toHaveClass(/verifychip--ok/, { timeout: 10000 });
});

test('retry recovers to verified', async ({ page }) => {
  await page.addInitScript(`
    window.__allow = false;
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (s, e) => window.__allow
        ? s({ coords: { latitude: ${AT_SITE.lat}, longitude: ${AT_SITE.lng}, accuracy: 12 } })
        : e && e({ code: 3, message: 'timeout' }),
      watchPosition: () => 0, clearWatch: () => {},
    }});
  `);
  await signIn(page);
  await page.goto('/clock');
  await clockIn(page).click();
  const chip = page.locator('.verifychip');
  await expect(chip).toHaveClass(/verifychip--warn/, { timeout: 8000 });
  await page.evaluate(() => { window.__allow = true; });
  await chip.locator('.verifychip__retry').click();
  await expect(chip).toHaveClass(/verifychip--ok/, { timeout: 8000 });
});
