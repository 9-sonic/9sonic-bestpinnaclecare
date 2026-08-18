import { test, expect } from '@playwright/test';
import { signIn, watchForErrors, expectNoHorizontalScroll, clockAction, clockButton } from './helpers.js';

// Clock-in assistance requests (kind=clock_assistance), sent through the carer
// requests pipeline and queued offline when there is no signal.

const MOCK_DB_KEY = 'bpc.mock.db.v4';
const ASSIST_QUEUE_KEY = 'bpc.assistance.queue';

const readStore = (page, key) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

const readMockDb = (page) => readStore(page, MOCK_DB_KEY);
// A queue that was never needed was never written, so absent means empty.
const readAssistQueue = async (page) => (await readStore(page, ASSIST_QUEUE_KEY)) ?? [];

async function gotoClock(page) {
  await page.goto('/clock');
  await expect(page.getByRole('button', { name: "Can't clock in?" })).toBeVisible({
    timeout: 10000,
  });
}

// Opens the assistance form the way a stranded carer would: clock screen,
// "Can't clock in?", then the request button in the advice sheet. The sheet
// stays open underneath — the form nests as a second overlay on purpose.
async function openAssistanceForm(page) {
  await page.getByRole('button', { name: "Can't clock in?" }).click();
  await page.getByRole('button', { name: 'Request help from the office' }).click();
  const dialog = page.getByRole('dialog', { name: 'Request help from the office' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('clock assistance requests', () => {
  test('sends a structured request to the office when online', async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page);
    await gotoClock(page);

    const dialog = await openAssistanceForm(page);
    await dialog.getByRole('button', { name: 'No phone signal' }).click();
    await dialog.locator('#assist-note').fill('Standing at the door, no signal at all.');
    await dialog.getByRole('button', { name: 'Send request' }).click();

    await expect(page.getByText('The office has been notified.')).toBeVisible();
    // Both the form and the advice sheet underneath it are gone.
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // The mock backend holds exactly what the office would see.
    const db = await readMockDb(page);
    expect(db.carer_requests).toHaveLength(1);
    const req = db.carer_requests[0];
    expect(req.kind).toBe('clock_assistance');
    expect(req.state).toBe('pending');
    expect(req.detail).toBe('Standing at the door, no signal at all.');
    expect(req.summary).toContain('No phone signal');
    expect(req.payload.reason).toBe('no_signal');
    expect(req.payload.client_request_id).toBeTruthy();
    expect(req.payload.visit_assignment_id).toBeTruthy();
    expect(req.payload.attempted_at).toBeTruthy();

    // Nothing was queued locally: it went straight through.
    expect(await readAssistQueue(page)).toEqual([]);

    expect(errors).toEqual([]);
  });

  test('queues the request offline and syncs it with the same id on reconnect', async ({
    page,
    context,
  }) => {
    const errors = watchForErrors(page);
    await signIn(page);
    await gotoClock(page);

    // Go offline only once the page is up — page.goto needs a connection.
    await context.setOffline(true);

    const dialog = await openAssistanceForm(page);
    await dialog.getByRole('button', { name: 'Too far from address' }).click();
    await dialog.getByRole('button', { name: 'Save & send when I have signal' }).click();

    await expect(
      page.getByText('Saved on this phone. It will be sent when you have signal.')
    ).toBeVisible();
    await expect(dialog).toHaveCount(0);

    // Held locally, keyed by its client_request_id, and nothing has reached
    // the office yet.
    const queued = await readAssistQueue(page);
    expect(queued).toHaveLength(1);
    expect(queued[0].kind).toBe('clock_assistance');
    const queuedId = queued[0].payload.client_request_id;
    expect(queuedId).toBeTruthy();
    expect((await readMockDb(page)).carer_requests).toEqual([]);

    await context.setOffline(false);

    await expect(page.getByText('Assistance request sent to the office')).toBeVisible({
      timeout: 10000,
    });

    // The queue is drained and the server saw the SAME client_request_id — a
    // replay must never become a second request.
    expect(await readAssistQueue(page)).toEqual([]);
    const db = await readMockDb(page);
    expect(db.carer_requests).toHaveLength(1);
    expect(db.carer_requests[0].payload.client_request_id).toBe(queuedId);
    expect(db.carer_requests[0].payload.reason).toBe('too_far');

    // Toggling the network races the lazy Google Fonts loads from index.html
    // (display=swap): an in-flight woff2 is aborted offline and its retry can
    // 404, which logs "Failed to load resource". Harness noise, not the app —
    // same class as the service-worker entries helpers.js already ignores.
    // Scoped to this test, the only one that toggles the network.
    expect(errors.filter((e) => !/Failed to load resource/.test(e))).toEqual([]);
  });

  test('opens pre-filled from a real clock failure', async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page);

    // Clock in on the first visit…
    await page.goto('/clock');
    await expect(clockButton(page, 'Clock In')).toBeVisible({ timeout: 10000 });
    await clockAction(page, 'Clock In');
    await expect(page.getByText('Clocked in')).toBeVisible({ timeout: 10000 });

    // …then try to clock in on another one, which the server refuses. (In
    // demo mode this conflict is the only clock failure that can be forced
    // deterministically; geofence and GPS failures come from the live API.)
    await page.goto('/clock?shift=103');
    await clockAction(page, 'Clock In');
    await expect(page.locator('.clock-error')).toBeVisible({ timeout: 10000 });

    // No reload from here: the captured error context lives in page state.
    const dialog = await openAssistanceForm(page);

    // The failure the carer just hit is recapped in the form, and the reason
    // falls back to a sane default for an unmapped error code.
    await expect(dialog.getByText(/Tried at /)).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Something else' })).toHaveClass(
      /cover-reason-chip--active/
    );

    await dialog.getByRole('button', { name: 'Send request' }).click();
    await expect(page.getByText('The office has been notified.')).toBeVisible();

    const db = await readMockDb(page);
    expect(db.carer_requests).toHaveLength(1);
    expect(db.carer_requests[0].payload.error_code).toBe('conflict');
    // Shift ids are strings in the UI layer (see toShift in api/adapters.js).
    expect(db.carer_requests[0].payload.visit_assignment_id).toBe('103');

    expect(errors).toEqual([]);
  });

  test('is reachable from the Help page and keeps the layout intact', async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page);

    await page.goto('/help');
    await page.getByRole('button', { name: 'Request help with clocking in' }).click();

    // Lands on the clock screen with the form already open.
    const dialog = page.getByRole('dialog', { name: 'Request help from the office' });
    await expect(dialog).toBeVisible({ timeout: 10000 });
    // No failure behind this entry, so there is no error recap.
    await expect(dialog.getByText(/Tried at /)).toHaveCount(0);

    await expectNoHorizontalScroll(page);
    expect(errors).toEqual([]);
  });
});
