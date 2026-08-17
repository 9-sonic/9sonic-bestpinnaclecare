// Every location outcome the clock screen can be in. These exist because
// getCurrentLocation() used to collapse "denied", "no signal", "timed out" and
// "still looking" into a single null, so the chip told a carer their location
// was fine while nothing had been captured — and nothing in the suite could see
// it, because none of the tests had ever failed a location request.

import { test, expect } from '@playwright/test';
import { signIn } from './helpers.js';

// Replace navigator.geolocation before any app code runs, so each failure mode
// can be driven deterministically.
const fake = (mode) => `
  const ok = (cb) => cb({ coords: { latitude: 53.44, longitude: -2.25, accuracy: 12 } });
  const fail = (code) => (_s, e) => e && e({ code, message: 'test' });
  Object.defineProperty(navigator, 'geolocation', {
    configurable: true,
    value: ${mode === 'none' ? 'undefined' : `{
      getCurrentPosition: ${
        mode === 'ok' ? '(s) => ok(s)'
        : mode === 'slow' ? '(s) => setTimeout(() => ok(s), 3000)'
        : `fail(${mode === 'denied' ? 1 : mode === 'unavailable' ? 2 : 3})`
      },
      watchPosition: () => 0, clearWatch: () => {},
    }`},
  });
`;

const CASES = [
  { mode: 'ok', tone: 'ok', match: /Verified · / },
  { mode: 'denied', tone: 'warn', match: /Not verified · location is off for this app/ },
  { mode: 'unavailable', tone: 'warn', match: /Not verified · no location signal/ },
  { mode: 'timeout', tone: 'warn', match: /Not verified · couldn't get a fix/ },
  { mode: 'none', tone: 'warn', match: /Not verified · no location signal/ },
];

for (const c of CASES) {
  test(`chip: ${c.mode}`, async ({ page }) => {
    await page.addInitScript(fake(c.mode));
    await signIn(page);
    await page.goto('/clock');
    const chip = page.locator('.verifychip');
    await expect(chip).toBeVisible();
    await expect(chip).toHaveClass(new RegExp(`verifychip--${c.tone}`), { timeout: 8000 });
    await expect(chip).toHaveText(c.match);

    // Retry is offered exactly when the chip is amber.
    const retry = chip.locator('.verifychip__retry');
    await expect(retry).toHaveCount(c.tone === 'warn' ? 1 : 0);

    // Clocking must never be blocked by a location failure.
    const btn = page.getByRole('button', { name: /Clock In/i }).first();
    if (await btn.count()) await expect(btn).toBeEnabled();
  });
}

test('pending is shown while looking, then resolves', async ({ page }) => {
  await page.addInitScript(fake('slow'));
  await signIn(page);
  await page.goto('/clock');
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
        ? s({ coords: { latitude: 53.44, longitude: -2.25, accuracy: 12 } })
        : e && e({ code: 3, message: 'timeout' }),
      watchPosition: () => 0, clearWatch: () => {},
    }});
  `);
  await signIn(page);
  await page.goto('/clock');
  const chip = page.locator('.verifychip');
  await expect(chip).toHaveClass(/verifychip--warn/, { timeout: 8000 });
  await page.evaluate(() => { window.__allow = true; });
  await chip.locator('.verifychip__retry').click();
  await expect(chip).toHaveClass(/verifychip--ok/, { timeout: 8000 });
});
