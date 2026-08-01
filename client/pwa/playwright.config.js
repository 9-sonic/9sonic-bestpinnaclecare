import { defineConfig, devices } from '@playwright/test';

// Regression tests for the carer PWA.
//
// These exist because three things broke silently in a row: a page kept its own
// copy of a shared card's markup and stopped matching it, a positioned button
// dropped out of the navigation grid and shifted every label, and a section of
// the home screen disappeared. None of those are caught by a build, a linter or
// a type checker. They are only caught by rendering the app and looking at it,
// so that is what these do.
//
// The suite starts its own dev server on a dedicated port so it never fights
// whatever you have open.
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // One dev server backs every worker, so a high count just makes each page
  // slower and turns real assertions into timeouts.
  workers: process.env.CI ? 2 : 4,
  // A cold sign-in on a loaded machine is slower than the default allows.
  timeout: 45000,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : [['list']],

  use: {
    baseURL: 'http://localhost:5310',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    // Service workers are blocked for most tests. Once one is active it serves
    // the app from cache, which makes every run depend on what a previous run
    // left behind and turned sign-in into a timeout. The tests that exist to
    // check the worker turn this back on for themselves.
    serviceWorkers: 'block',
  },

  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
  ],

  // Tests run against a production build served by `vite preview`, not the dev
  // server. Two reasons:
  //
  //   The dev server compiles each route chunk the first time it is requested.
  //   With several workers signing in at once that queue was slow enough to
  //   time out the tests, which looked like real failures and were not.
  //
  //   It is also what actually ships. A dev-only bug is worth catching, but a
  //   bug that only exists in the build is worse, and the dev server would
  //   never see it.
  webServer: {
    command: 'npm run build && npx vite preview --port 5310 --strictPort',
    url: 'http://localhost:5310',
    reuseExistingServer: !process.env.CI,
    timeout: 180000,
    env: { VITE_USE_MOCK: 'true' },
  },
});
