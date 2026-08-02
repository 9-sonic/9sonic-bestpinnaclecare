import { lazy } from 'react';

// Wraps React.lazy so a failed chunk download does not dead-end the app.
//
// Screens are code split, so each navigation fetches a JS chunk. That fetch can
// fail for reasons that have nothing to do with the code: a flaky mobile
// connection, a dev server restarting, or a deploy replacing the files the open
// tab was built against. Left alone, React surfaces this to the error boundary
// and the carer is stranded on an error screen mid shift.
//
// Strategy: retry a few times with backoff, since most of these clear on their
// own within a second. Only if that fails do we reload once to pick up a new
// build, guarded by a session flag so we can never loop.

const RELOAD_FLAG = 'bpc.chunk.reloaded';
const ATTEMPTS = 3;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function isChunkLoadError(error) {
  const message = String(error?.message ?? '');
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    error?.name === 'ChunkLoadError'
  );
}

export function lazyWithRetry(importer) {
  return lazy(async () => {
    let lastError;

    for (let attempt = 0; attempt < ATTEMPTS; attempt += 1) {
      try {
        const module = await importer();
        // A clean load means any earlier trouble is behind us.
        sessionStorage.removeItem(RELOAD_FLAG);
        return module;
      } catch (error) {
        lastError = error;
        if (!isChunkLoadError(error)) throw error;
        // 250ms, then 500ms. Long enough for a blip, short enough to feel instant.
        if (attempt < ATTEMPTS - 1) await sleep(250 * (attempt + 1));
      }
    }

    // Still failing: the build on the server is probably newer than this tab.
    if (sessionStorage.getItem(RELOAD_FLAG) !== '1') {
      sessionStorage.setItem(RELOAD_FLAG, '1');
      window.location.reload();
      // Hold the promise open so nothing renders while the reload happens.
      return new Promise(() => {});
    }

    throw lastError;
  });
}

export default lazyWithRetry;
