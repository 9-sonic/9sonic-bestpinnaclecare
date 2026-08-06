import { test, expect } from '@playwright/test';
import { signIn, ROUTES, watchForErrors, expectNoHorizontalScroll, LONG } from './helpers.js';

// Each of these locks in something that has already broken once.

test.describe('every screen renders', () => {
  for (const route of ROUTES) {
    test(`${route.path} renders and logs nothing`, async ({ page }) => {
      const errors = watchForErrors(page);
      await signIn(page);
      await page.goto(route.path);

      // The error boundary must not be showing.
      await expect(page.locator('.error-screen')).toHaveCount(0);
      // And the page's own content must be there.
      await expect(page.locator(route.expect).first()).toBeVisible({ timeout: 10000 });

      expect(errors, `console errors on ${route.path}`).toEqual([]);
    });
  }
});

test.describe('bottom navigation', () => {
  test.skip(({ isMobile }) => !isMobile, 'the tab bar only exists on phones');

  // Regression: the clock button was positioned out of the grid, so the four
  // remaining tabs slid left into columns 1 to 4. That put "Chats" under the
  // floating button and left an empty column on the right.
  test('has five evenly spaced cells with the right labels', async ({ page }) => {
    await signIn(page);

    const nav = page.locator('.bottom-nav');
    await expect(nav).toBeVisible();
    await expect(page.locator('.bottom-nav__fab')).toBeVisible();

    const measured = await nav.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return [...el.children].map((child) => {
        const b = child.getBoundingClientRect();
        return {
          label:
            child.querySelector('.bottom-nav__label, .bottom-nav__fab-label')?.textContent ?? '',
          centre: b.left + b.width / 2 - box.left,
          expected: 0,
          navWidth: box.width,
        };
      });
    });

    expect(measured).toHaveLength(5);
    expect(measured.map((c) => c.label)).toEqual([
      'Home',
      'Shifts',
      'Clock',
      'Chats',
      'Profile',
    ]);

    // Each cell centred in its fifth of the bar.
    measured.forEach((cell, i) => {
      const expected = ((i + 0.5) * cell.navWidth) / 5;
      expect(Math.abs(cell.centre - expected), `cell ${i} (${cell.label}) off centre`).toBeLessThanOrEqual(2);
    });
  });

  // Regression: paint containment on the bar clipped the top off the button,
  // and a negative margin never lifted it clear of the bar in the first place.
  test('the clock button floats clear of the bar and stays round', async ({ page }) => {
    await signIn(page);
    await expect(page.locator('.bottom-nav__fab')).toBeVisible();

    const geometry = await page.evaluate(() => {
      const nav = document.querySelector('.bottom-nav');
      const fab = document.querySelector('.bottom-nav__fab');
      const n = nav.getBoundingClientRect();
      const f = fab.getBoundingClientRect();
      return {
        overhang: n.top - f.top,
        width: f.width,
        height: f.height,
        contain: getComputedStyle(nav).contain,
      };
    });

    expect(geometry.overhang, 'button does not rise above the bar').toBeGreaterThan(10);
    expect(Math.round(geometry.width)).toBe(Math.round(geometry.height));
    // Paint containment would clip the overhang away again.
    expect(geometry.contain).not.toContain('paint');
  });
});

test.describe('home screen', () => {
  // The latest design leads with one featured visit, then the week as a ring
  // plus two counts. The shape has changed twice now; what this test is really
  // protecting is unchanged, which is that the figures a carer opens the app
  // for must not quietly disappear.
  test('keeps the featured visit and the week summary', async ({ page }) => {
    await signIn(page);

    // The visit being acted on, with somewhere to go and someone to call.
    await expect(page.locator('.fvisit')).toHaveCount(1);
    await expect(page.locator('.fvisit__tile')).toHaveCount(2);
    await expect(page.locator('.fvisit__call')).toBeVisible();

    // The week: hours as a ring, then the two counts beside it.
    await expect(page.locator('.hours-ring')).toBeVisible();
    await expect(page.locator('.ministat')).toHaveCount(2);

    // The ring must actually be drawn, not left at zero length. A ring showing
    // nothing looks identical to one that failed to render.
    const drawn = await page.locator('.hours-ring__arc').evaluate((el) => {
      const total = Number(el.getAttribute('stroke-dasharray'));
      const offset = Number(el.getAttribute('stroke-dashoffset'));
      return { total, offset, swept: total - offset };
    });
    expect(drawn.total, 'the hours ring has no circumference').toBeGreaterThan(0);
    expect(drawn.swept, 'the hours ring is empty').toBeGreaterThan(0);
  });
});

test.describe('clock dial', () => {
  // Regression: the dial has been redesigned three times and each pass appended
  // rules without removing the last, so leftovers from earlier versions were
  // still applying. Between them they rotated the SVG a quarter turn, pinned a
  // 176px height against a 300px width, and left an opaque white disc over the
  // whole thing. The dial rendered as a blank squashed ellipse with no ring,
  // no ticks and no plate — and every element was present in the DOM, so
  // checking that the parts exist proves nothing. Geometry is what broke, so
  // geometry is what this measures.
  test('is round, upright, and not covered by its own face', async ({ page }) => {
    await signIn(page);
    await page.goto('/clock');
    await page.locator('.dial').waitFor({ state: 'visible' });

    const dial = await page.locator('.dial').boundingBox();
    expect(Math.abs(dial.width - dial.height), 'the dial is not square').toBeLessThanOrEqual(1);

    // The SVG must fill the dial without being rotated: a quarter turn swaps
    // its box, which stays square and so would otherwise pass unnoticed.
    const svg = await page.locator('.dial__svg').boundingBox();
    expect(Math.abs(svg.width - dial.width), 'the svg does not fill the dial').toBeLessThanOrEqual(1);
    const rotated = await page.locator('.dial__svg').evaluate((el) => {
      const t = getComputedStyle(el).transform;
      return t !== 'none' && t !== 'matrix(1, 0, 0, 1, 0, 0)';
    });
    expect(rotated, 'the svg is transformed').toBe(false);

    // The face holds the time and nothing else. Any background on it hides the
    // ring, the ticks and the plate underneath.
    const face = await page.locator('.dial__face').evaluate((el) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, image: cs.backgroundImage, shadow: cs.boxShadow };
    });
    expect(face.bg, 'the dial face is painted over the dial').toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
    expect(face.image).toBe('none');
    expect(face.shadow).toBe('none');

    // The plate is drawn in the SVG and has to be a real circle inside it.
    const plate = await page.locator('.dial__plate').boundingBox();
    expect(Math.abs(plate.width - plate.height), 'the plate is an ellipse').toBeLessThanOrEqual(1);
    expect(plate.width, 'the plate is too small for the dial').toBeGreaterThan(dial.width * 0.5);
  });
});

test.describe('shift cards', () => {
  // The redesign leads with the person rather than a time column, but the
  // original regression still matters: the clock screen once carried its own
  // copy of this markup and collapsed into an unreadable vertical strip when
  // the shared card changed. Both screens must render the same component.
  test('lead with the avatar beside the details, never stacked', async ({ page }) => {
    await signIn(page);

    for (const path of ['/shifts', '/clock', '/home']) {
      await page.goto(path);
      const cards = page.locator('.vcard');
      await expect(cards.first(), `${path}: no shift cards rendered`).toBeVisible({ timeout: 10000 });

      const shape = await cards.first().evaluate((el) => {
        const avatar = el.querySelector('.avatar');
        const body = el.querySelector('.vcard__name');
        if (!avatar || !body) return { missing: true };
        const a = avatar.getBoundingClientRect();
        const b = body.getBoundingClientRect();
        return {
          missing: false,
          sideBySide: b.left >= a.right - 2,
          avatarSize: a.width,
        };
      });

      expect(shape.missing, `${path}: card is missing the shared structure`).toBe(false);
      expect(shape.sideBySide, `${path}: card content is stacked vertically`).toBe(true);
      expect(shape.avatarSize).toBeGreaterThan(20);
    }
  });
});

test.describe('long database values', () => {
  test.skip(({ isMobile }) => !isMobile, 'overflow bites hardest on a phone');

  // Regression guard: names, addresses and notes come from a database and are
  // routinely longer than the design assumed.
  test('never push the page sideways', async ({ page }) => {
    // Visits five screens in one test while sharing a dev server with the
    // other workers, so it needs more than the default budget. Without this it
    // fails only under full parallel load, which is the worst kind of failure:
    // it looks like a real regression and is not.
    test.slow();
    await signIn(page);

    await page.evaluate((long) => {
      const key = 'bpc.mock.db.v4';
      const db = JSON.parse(localStorage.getItem(key));
      db.visit_assignments.forEach((va) => {
        va.visit.service_user.full_name = long.name;
        va.visit.service_user.address_line1 = long.token;
        va.visit.notes = long.note;
      });
      db.notifications.forEach((n) => {
        n.title = long.name;
        n.body = long.note;
      });
      localStorage.setItem(key, JSON.stringify(db));
    }, LONG);

    // Wait for each page's own content rather than a fixed delay: under
    // parallel load the dev server is slow enough that a timeout measures an
    // empty page and passes for the wrong reason, or half a page and fails.
    const pages = [
      { path: '/home', ready: '.fvisit, .home-stats' },
      { path: '/shifts', ready: '.cal' },
      { path: '/notifications', ready: '.ncard, .empty-state' },
      { path: '/messages', ready: '.thread-row, .empty-state' },
      { path: '/clock', ready: '.dial, .empty-state' },
    ];

    for (const { path, ready } of pages) {
      await page.goto(path);
      await expect(page.locator(ready).first()).toBeVisible({ timeout: 15000 });
      await expectNoHorizontalScroll(page);
    }
  });
});

test.describe('back button', () => {
  test.skip(({ isMobile }) => !isMobile, 'back is the phone dismissal gesture');

  // Regression: React StrictMode double-invoked the effect that pushes the
  // history entry, so back exited the screen instead of closing the sheet.
  test('closes a sheet without leaving the page', async ({ page }) => {
    await signIn(page);
    await page.goto('/profile');

    await page.getByRole('button', { name: /terms of use/i }).click();
    await expect(page.locator('.modal')).toBeVisible();

    await page.goBack();
    await expect(page.locator('.modal')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/profile');
  });

  test('closes the menu drawer without leaving the page', async ({ page }) => {
    await signIn(page);

    await page.getByRole('button', { name: /open menu/i }).click();
    await expect(page.locator('.drawer')).toBeVisible();

    await page.goBack();
    await expect(page.locator('.drawer')).toHaveCount(0);
    expect(new URL(page.url()).pathname).toBe('/home');
  });
});

test.describe('sticky headers', () => {
  test('stay in place while the page scrolls', async ({ page }) => {
    await signIn(page);
    await page.goto('/notifications');

    // Let the screen's entry animation finish first: measuring mid-animation
    // reports a few pixels of offset that look like the header scrolling away.
    await page.evaluate(() => {
      document.getAnimations().forEach((a) => {
        try {
          a.finish();
        } catch {
          /* some animations cannot be finished; harmless */
        }
      });
    });
    await page.waitForTimeout(150);

    // The app scrolls inside .app-content, not the window, so scroll that.
    // A wheel event at the pointer nudges the page a few pixels before the
    // inner container takes over, which is not the header coming unstuck.
    const header = page.locator('.screen-header').first();
    const before = await header.boundingBox();
    await page.evaluate(() => {
      document.querySelector('.app-content')?.scrollBy(0, 600);
    });
    await page.waitForTimeout(400);
    const after = await header.boundingBox();

    // A header that has come unstuck travels with the content, hundreds of
    // pixels for a 600px scroll. A few pixels of settle from safe-area and
    // sub-pixel rounding is not that, and holding this to zero made the test
    // fail on noise rather than on regressions.
    expect(Math.abs(after.y - before.y), 'header scrolled away').toBeLessThanOrEqual(8);
  });
});

test.describe('accessibility basics', () => {
  test.skip(({ isMobile }) => !isMobile, 'touch targets are a phone concern');

  // The floor is 44px, which is what Apple asks for; Android asks for 48. It
  // used to be 32, which passed while nineteen controls were still too small
  // for a finger, including the "Clock in" button on the shift detail page.
  //
  // Several controls stay visually small on purpose and carry an invisible
  // padded hit area instead, so this measures the area that actually responds
  // to a tap: the element's own box, or its ::after if that is larger.
  test('every control is big enough to tap and is labelled', async ({ page }) => {
    await signIn(page);

    for (const route of ROUTES) {
      await page.goto(route.path);
      await page.waitForTimeout(500);

      const problems = await page.evaluate(() => {
        const bad = { small: [], unlabelled: [] };
        document
          .querySelectorAll('button, a[href], [role="switch"], [role="button"], input:not([type="hidden"]), select')
          .forEach((el) => {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) return;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) return;

            // The hit area may be an ::after larger than the element itself.
            const after = getComputedStyle(el, '::after');
            let w = r.width;
            let h = r.height;
            if (after.content !== 'none') {
              const aw = parseFloat(after.width);
              const ah = parseFloat(after.height);
              if (Number.isFinite(aw)) w = Math.max(w, aw);
              if (Number.isFinite(ah)) h = Math.max(h, ah);
              // An inset-based area (the switch) grows the box on both sides.
              const inset = parseFloat(after.top);
              if (Number.isFinite(inset) && inset < 0) {
                w = Math.max(w, r.width - inset * 2);
                h = Math.max(h, r.height - inset * 2);
              }
            }

            const name = (el.className || el.tagName).toString().split(' ')[0];
            if (h < 44 || w < 44) bad.small.push(`${name} ${Math.round(w)}x${Math.round(h)}`);
            const labelled =
              el.textContent.trim().length > 0 ||
              el.getAttribute('aria-label') ||
              el.getAttribute('aria-labelledby') ||
              ['INPUT', 'SELECT'].includes(el.tagName);
            if (!labelled) bad.unlabelled.push(name);
          });
        return bad;
      });

      expect(problems.small, `${route.path}: controls smaller than 44px`).toEqual([]);
      expect(problems.unlabelled, `${route.path}: controls with no accessible name`).toEqual([]);
    }
  });
});

test.describe('overlays', () => {
  test.skip(({ isMobile }) => !isMobile, 'the tab bar only exists on phones');

  // Regression: the sheet was reported as unusable in the installed app,
  // its buttons sitting under the tab bar. It is now lifted clear of the bar
  // entirely so there is nothing to argue about.
  test('a sheet rests above the tab bar with its buttons reachable', async ({ page }) => {
    await signIn(page);
    await page.goto('/profile');

    await page.getByRole('button', { name: /log out/i }).first().click();
    await expect(page.locator('.modal')).toBeVisible();

    const geometry = await page.evaluate(async () => {
      // Settle the opening animation so resting geometry is measured.
      document.getAnimations().forEach((a) => {
        try {
          a.finish();
        } catch {
          /* some animations cannot be finished, ignore */
        }
      });
      await new Promise((r) => setTimeout(r, 120));

      const sheet = document.querySelector('.modal');
      const nav = document.querySelector('.bottom-nav');
      const footer = document.querySelector('.modal__footer');
      const s = sheet.getBoundingClientRect();
      const n = nav.getBoundingClientRect();

      const buttons = [...footer.querySelectorAll('.btn')].map((b) => {
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { label: b.textContent.trim(), reachable: !!(hit && (hit === b || b.contains(hit))) };
      });

      return {
        sheetBottom: s.bottom,
        navTop: n.top,
        portalled: document.querySelector('.modal-backdrop').parentElement === document.body,
        buttons,
      };
    });

    expect(geometry.portalled, 'sheet must be portalled onto the body').toBe(true);
    expect(geometry.sheetBottom, 'sheet overlaps the tab bar').toBeLessThanOrEqual(geometry.navTop + 1);
    geometry.buttons.forEach((b) => {
      expect(b.reachable, `${b.label} cannot be tapped`).toBe(true);
    });
  });

  // Regression: the page behind an overlay could still be scrolled.
  test('the page behind cannot scroll', async ({ page }) => {
    await signIn(page);
    await page.goto('/profile');

    await page.getByRole('button', { name: /log out/i }).first().click();
    await expect(page.locator('.modal')).toBeVisible();

    const locked = await page.evaluate(async () => {
      const before = window.scrollY;
      window.scrollBy(0, 300);
      await new Promise((r) => setTimeout(r, 200));
      return { moved: window.scrollY !== before, bodyPinned: getComputedStyle(document.body).position === 'fixed' };
    });

    expect(locked.bodyPinned, 'body is not pinned').toBe(true);
    expect(locked.moved, 'page scrolled behind the sheet').toBe(false);
  });
});

test.describe('chat templates', () => {
  // Regression: tapping a template sent it immediately, giving no chance to
  // add the detail that actually matters.
  test('append to the box instead of sending', async ({ page }) => {
    await signIn(page);
    await page.goto('/messages/301');
    await expect(page.locator('.chat__composer')).toBeVisible();

    const before = await page.locator('.bubble').count();

    await page.locator('.quick-reply').first().click();
    await expect(page.locator('.chat__input')).not.toHaveValue('');
    expect(await page.locator('.bubble').count(), 'template was sent').toBe(before);

    // A second tap appends rather than replacing.
    const first = await page.locator('.chat__input').inputValue();
    await page.locator('.quick-reply').nth(1).click();
    const second = await page.locator('.chat__input').inputValue();

    expect(second.length).toBeGreaterThan(first.length);
    expect(second).toContain(first.replace(/\.$/, ''));
    expect(await page.locator('.bubble').count(), 'template was sent').toBe(before);
  });
});

test.describe('installability', () => {
  // This group is about the worker and the manifest, so it needs the real
  // thing rather than the blocked default.
  test.use({ serviceWorkers: 'allow' });

  // Regression: the manifest declared the 2667x1611 landscape logo as a
  // 512x512 icon. Android Chrome checks the declared size against the real
  // image, rejected every icon, and so never fired beforeinstallprompt. The
  // Install button then had nothing to call and appeared to do nothing. iOS
  // does not validate this, which is why it only failed on Android.
  test('every manifest icon is the size it claims to be', async ({ page }) => {
    await page.goto('/');

    const result = await page.evaluate(async () => {
      const link = document.querySelector('link[rel=manifest]');
      const manifest = await (await fetch(link.href)).json();

      const icons = await Promise.all(
        manifest.icons.map(
          (icon) =>
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () =>
                resolve({
                  src: icon.src,
                  declared: icon.sizes,
                  actual: `${img.naturalWidth}x${img.naturalHeight}`,
                });
              img.onerror = () =>
                resolve({ src: icon.src, declared: icon.sizes, actual: 'MISSING' });
              img.src = icon.src;
            })
        )
      );

      return { manifest, icons };
    });

    const wrong = result.icons.filter((i) => i.declared !== i.actual);
    expect(wrong, 'icons whose real size does not match the manifest').toEqual([]);

    // Android needs both of these at minimum, plus something maskable or the
    // launcher crops the artwork badly.
    const sizes = result.manifest.icons.map((i) => i.sizes);
    expect(sizes, 'missing the 192px icon Android requires').toContain('192x192');
    expect(sizes, 'missing the 512px icon Android requires').toContain('512x512');
    expect(
      result.manifest.icons.some((i) => i.purpose?.includes('maskable')),
      'no maskable icon'
    ).toBe(true);
  });

  test('the manifest has what a browser needs to offer an install', async ({ page }) => {
    await page.goto('/');

    const manifest = await page.evaluate(async () => {
      const link = document.querySelector('link[rel=manifest]');
      return (await fetch(link.href)).json();
    });

    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(['standalone', 'fullscreen', 'minimal-ui']).toContain(manifest.display);
    // A stable id, or changing start_url later orphans installed copies.
    expect(manifest.id).toBeTruthy();

    // Mojibake check: the name is shown on the install dialog, and an em dash
    // came through the build double encoded once already.
    expect(manifest.name, 'name looks mis-encoded').not.toMatch(/[\u00c2\u00e2\u20ac]/);
    expect(manifest.short_name).not.toMatch(/[\u00c2\u00e2\u20ac]/);
  });

  // Regression: initServiceWorker threw before registering because a helper was
  // called without being imported, and the failure was swallowed by an
  // unawaited async function. Without a worker there is no offline support and
  // Chrome will not treat the app as installable.
  test('a service worker registers and activates', async ({ page }) => {
    await page.goto('/');

    const sw = await page.evaluate(async () => {
      // Registration is deferred behind a dynamic import.
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs.some((r) => r.active)) {
          return { count: regs.length, active: true, script: regs[0].active.scriptURL };
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      return { count: 0, active: false, script: null };
    });

    expect(sw.active, 'no active service worker').toBe(true);
    expect(sw.script).toContain('sw.js');
  });
});
