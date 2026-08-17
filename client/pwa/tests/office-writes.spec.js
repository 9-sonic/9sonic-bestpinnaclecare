import { test, expect } from '@playwright/test';
import { signIn, watchForErrors } from './helpers.js';

// Carer actions that have to reach the office.
//
// Each of these used to be written to localStorage and reported as saved, so
// the carer got a green toast for something nobody in the office would ever
// see. These tests exist to stop that coming back: they assert the record the
// office would read, and — where it matters — that a replay leaves one of it
// rather than two.

const MOCK_DB_KEY = 'bpc.mock.db.v4';
const VISIT_LOCAL_KEY = 'bpc.local.visits';
const ASSIST_QUEUE_KEY = 'bpc.assistance.queue';

const readStore = (page, key) =>
  page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? 'null'), key);

const readMockDb = (page) => readStore(page, MOCK_DB_KEY);
// A buffer that was never needed was never written, so absent means empty.
const readVisitLocal = async (page) => (await readStore(page, VISIT_LOCAL_KEY)) ?? {};
const readAssistQueue = async (page) => (await readStore(page, ASSIST_QUEUE_KEY)) ?? [];

async function gotoShift(page) {
  await page.goto('/shifts/102');
  await expect(page.locator('.detail-hero')).toBeVisible({ timeout: 10000 });
}

test.describe('visit notes reach the office', () => {
  test('saves the write-up and clears the unsent buffer', async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page);
    await gotoShift(page);

    await page.locator('.notes-card__input').fill('Ate a full breakfast, in good spirits.');
    await page.getByRole('button', { name: 'Save note' }).click();

    await expect(page.getByText('Visit note saved')).toBeVisible();

    // The office's copy.
    const db = await readMockDb(page);
    expect(db.local.visitNotes['102']).toBe('Ate a full breakfast, in good spirits.');

    // And nothing left pending on the device: an entry here means "this phone
    // holds something the office has not been told about", so a successful
    // save has to leave it empty.
    expect(await readVisitLocal(page)).toEqual({});

    expect(errors).toEqual([]);
  });

  test('a second save of an unchanged note does not queue it again', async ({ page }) => {
    await signIn(page);
    await gotoShift(page);

    await page.locator('.notes-card__input').fill('Same note twice.');
    await page.getByRole('button', { name: 'Save note' }).click();
    // The save toast from the first click is still on screen when the second
    // lands, so it cannot mark a save's completion — the buffer can. An entry
    // in it means "the office has not confirmed this", so a finished save
    // leaves it empty.
    await expect.poll(() => readVisitLocal(page)).toEqual({});

    await page.getByRole('button', { name: 'Save note' }).click();
    await expect.poll(() => readVisitLocal(page)).toEqual({});
  });
});

test.describe('declining a visit reaches the office', () => {
  test('raises a real carer request rather than only changing the screen', async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page);
    await gotoShift(page);

    await page.getByRole('button', { name: 'Decline' }).click();
    const dialog = page.getByRole('dialog', { name: 'Request shift cover' });
    await expect(dialog).toBeVisible();

    await dialog.getByRole('button', { name: '🚗 Transport issue' }).click();
    await dialog.locator('#cover-note').fill('Car will not start.');
    await dialog.getByRole('button', { name: 'Request cover' }).click();

    await expect(page.getByText('Cover requested. The office has been notified.')).toBeVisible();

    const db = await readMockDb(page);
    expect(db.carer_requests).toHaveLength(1);
    const req = db.carer_requests[0];
    // `drop` is a kind the server actually accepts (CarerRequest::KINDS); the
    // chosen reason travels in the payload rather than in the kind.
    expect(req.kind).toBe('drop');
    expect(req.state).toBe('pending');
    expect(req.detail).toBe('Car will not start.');
    expect(req.payload.reason).toBe('transport');
    expect(req.payload.visit_assignment_id).toBeTruthy();
    expect(req.payload.client_request_id).toBeTruthy();

    expect(errors).toEqual([]);
  });

  test('holds the request on the phone when there is no signal, and says so', async ({
    page,
    context,
  }) => {
    await signIn(page);
    await gotoShift(page);
    await context.setOffline(true);

    await page.getByRole('button', { name: 'Decline' }).click();
    const dialog = page.getByRole('dialog', { name: 'Request shift cover' });
    await dialog.getByRole('button', { name: '🤒 Unwell / Sick' }).click();
    await dialog.getByRole('button', { name: 'Request cover' }).click();

    // The honest message: held here, not "the office has been notified".
    await expect(
      page.getByText('Saved on this phone. It will be sent when you have signal.')
    ).toBeVisible();

    const queued = await readAssistQueue(page);
    expect(queued).toHaveLength(1);
    expect(queued[0].kind).toBe('drop');
    expect(queued[0].payload.client_request_id).toBeTruthy();

    await context.setOffline(false);
  });
});

test.describe('my requests screen', () => {
  test('a request raised on a visit appears with its office-facing status', async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page);
    await gotoShift(page);

    await page.getByRole('button', { name: 'Decline' }).click();
    const dialog = page.getByRole('dialog', { name: 'Request shift cover' });
    await dialog.getByRole('button', { name: '🤒 Unwell / Sick' }).click();
    await dialog.getByRole('button', { name: 'Request cover' }).click();
    await expect(page.getByText('Cover requested. The office has been notified.')).toBeVisible();

    await page.goto('/profile/requests');
    const card = page.locator('.ncard', { hasText: 'Cover needed' });
    await expect(card).toBeVisible({ timeout: 10000 });
    await expect(card.locator('.ncard__kind')).toHaveText('Cover');
    await expect(card.locator('.badge')).toHaveText('Pending');

    expect(errors).toEqual([]);
  });
});

test.describe('notification preferences persist', () => {
  test('a toggle is written to the API, not just to component state', async ({ page }) => {
    const errors = watchForErrors(page);
    await signIn(page);
    await page.goto('/profile/preferences');
    await expect(page.locator('.list-row').first()).toBeVisible({ timeout: 10000 });

    const messages = page.getByRole('switch', { name: 'Messages' });
    await expect(messages).toHaveAttribute('aria-checked', 'true');
    await messages.click();
    await expect(messages).toHaveAttribute('aria-checked', 'false');

    await expect
      .poll(async () => {
        const db = await readMockDb(page);
        return db.notification_preferences.find((p) => p.notification_type === 'message')?.in_app;
      })
      .toBe(false);

    // And it survives a reload, which is the whole point — these switches used
    // to spring back to their defaults because nothing was ever written.
    await page.reload();
    await expect(page.getByRole('switch', { name: 'Messages' })).toHaveAttribute(
      'aria-checked',
      'false'
    );

    expect(errors).toEqual([]);
  });
});
