import { useCallback, useSyncExternalStore } from 'react';
import {
  subscribe,
  getSnapshot,
  promptInstall as runPrompt,
} from '../utils/installStore.js';

// Install to home screen.
//
// The prompt itself lives in a module level store rather than component state,
// because Chrome fires `beforeinstallprompt` before React mounts and there is
// only ever one event to share between the banner and the profile row. See
// utils/installStore.js.
//
// iOS never fires the event at all, so there the app shows the manual
// Share, then Add to Home Screen steps instead.

const DISMISS_KEY = 'bpc.install.dismissed';

function isIos() {
  const ua = navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    // iPadOS reports itself as a Mac, so touch support disambiguates.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

// Chrome and Edge on Android can install. Firefox and Opera on Android, and
// every browser inside another app's webview, cannot, and telling someone to
// tap a button that will never work is worse than saying so.
function supportsInstall() {
  const ua = navigator.userAgent;
  if (isIos()) return true; // manual, but possible
  const isAndroid = /android/i.test(ua);
  const isChromium = /chrome|chromium|edg/i.test(ua) && !/firefox|fxios|opr\//i.test(ua);
  return isAndroid ? isChromium : isChromium;
}

let dismissedCache = null;

export function useInstallPrompt() {
  const { available, installed } = useSyncExternalStore(subscribe, getSnapshot);

  const dismissed =
    dismissedCache ?? (dismissedCache = localStorage.getItem(DISMISS_KEY) === '1');

  const ios = isIos();

  const promptInstall = useCallback(async () => {
    const outcome = await runPrompt();
    if (outcome === 'accepted') {
      localStorage.removeItem(DISMISS_KEY);
      dismissedCache = false;
    }
    return outcome;
  }, []);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, '1');
    dismissedCache = true;
  }, []);

  return {
    // The banner only appears when installing is genuinely possible now.
    canInstall: !installed && !dismissed && (available || ios),
    // The profile row is always shown while uninstalled, so there is a way in
    // even if the browser has not offered the prompt yet.
    installed,
    isIos: ios,
    // True when the browser has handed us a usable prompt.
    ready: available,
    supported: supportsInstall(),
    promptInstall,
    dismiss,
  };
}

export default useInstallPrompt;
