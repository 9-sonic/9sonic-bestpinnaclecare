// Tactile feedback.
//
// Android and Chrome support the Vibration API. iOS does not, and this is a
// platform decision rather than a bug in this app:
//
//   Safari has never implemented navigator.vibrate, on any iOS version, and
//   that applies to every browser on iOS because they are all required to use
//   WebKit underneath. Chrome and Firefox on an iPhone are the same engine, so
//   none of them will vibrate. There is no permission to grant and no flag to
//   set. Apple has kept haptics for native apps.
//
// There is one narrow exception, used below. Safari 17.4 added a switch styled
// checkbox that plays a real system haptic when it is toggled. Toggling a
// hidden one is a hack, but it is the only way to produce a tap on iOS from a
// web page, and it degrades to nothing anywhere it is unsupported.
// That is why these are plain function calls with no capability checks at the
// call site: the check lives here once.
//
// Durations are deliberately short. Anything above about 20ms for a routine tap
// feels like a fault rather than a response. The patterns follow the same
// grammar as native haptics: one pulse acknowledges, two rising confirms,
// three sharp warns.

const REDUCED_KEY = 'bpc.haptics.off';

function enabled() {
  if (typeof navigator === 'undefined') return false;
  // Someone who finds vibration unpleasant can turn it off in Preferences.
  try {
    if (localStorage.getItem(REDUCED_KEY) === '1') return false;
  } catch {
    /* storage unavailable, assume on */
  }
  return true;
}

// The iOS fallback: a visually hidden switch checkbox. Toggling it makes
// WebKit play the system switch haptic. Created once and reused.
let iosSwitch = null;

function isIos() {
  if (typeof navigator === 'undefined') return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac, so check for touch as well.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

function iosSwitchTap() {
  if (!iosSwitch) {
    iosSwitch = document.createElement('input');
    iosSwitch.type = 'checkbox';
    // The `switch` attribute is what triggers the haptic in Safari 17.4+.
    iosSwitch.setAttribute('switch', '');
    iosSwitch.setAttribute('aria-hidden', 'true');
    iosSwitch.tabIndex = -1;
    // Off screen rather than display:none, which would stop it working.
    iosSwitch.style.cssText =
      'position:fixed;top:-100px;left:-100px;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(iosSwitch);
  }
  iosSwitch.checked = !iosSwitch.checked;
}

function buzz(pattern) {
  if (!enabled()) return;

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(pattern);
    } catch {
      /* some browsers throw if the page is not visible */
    }
    return;
  }

  // No Vibration API. On iOS the switch trick gives a single tap; it cannot
  // express a pattern, so every feedback level feels the same there. That is
  // still better than nothing for confirming a clock in.
  if (isIos()) {
    try {
      iosSwitchTap();
    } catch {
      /* not supported on this version, nothing to do */
    }
  }
}

// A tap landed: buttons, list rows, tabs, toggles.
export function tapFeedback() {
  buzz(8);
}

// Something small changed as a result: switching a toggle, picking a date.
export function selectFeedback() {
  buzz(5);
}

// An action succeeded and mattered: clocked in, message sent, note saved.
export function successFeedback() {
  buzz([12, 40, 18]);
}

// Something went wrong, or was refused.
export function errorFeedback() {
  buzz([40, 35, 40]);
}

// A warning that is not a failure: saved offline, outside the geofence.
export function warnFeedback() {
  buzz([18, 60, 18]);
}

export function setHapticsEnabled(on) {
  try {
    if (on) localStorage.removeItem(REDUCED_KEY);
    else localStorage.setItem(REDUCED_KEY, '1');
  } catch {
    /* nothing to do */
  }
}

export function hapticsEnabled() {
  try {
    return localStorage.getItem(REDUCED_KEY) !== '1';
  } catch {
    return true;
  }
}

// True when the device can produce any tactile feedback at all. Used by
// Preferences so the toggle is not offered where it would do nothing.
export function hapticsSupported() {
  if (typeof navigator === 'undefined') return false;
  return typeof navigator.vibrate === 'function' || isIos();
}

// Which mechanism is in play, so support can answer "why does my iPhone not
// buzz" without guesswork.
export function hapticsMode() {
  if (typeof navigator === 'undefined') return 'none';
  if (typeof navigator.vibrate === 'function') return 'vibration-api';
  if (isIos()) return 'ios-switch';
  return 'none';
}
